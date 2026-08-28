import { useCallback, useEffect, useRef, useState } from "react";
import {
  CSC_MEASUREMENT_UUID,
  CSC_SERVICE_UUID,
  createCscCadenceTracker,
  parseCscCrankSample,
} from "../lib/bleCscCadence";
import { bleReconnectDelayMs, selectGrantedCadenceDevice } from "../lib/bleAutoReconnect";
import type { BleCrankRpmUiState } from "../lib/cadenceSensorUi";

/** 정지(0rpm) 판정을 위한 폴링 주기 — stall 임계보다 충분히 짧게 */
const STALL_POLL_MS = 400;
/** 크랭크 필드 없는 패킷이 이만큼 연속되면 「케이던스 모드 아님」으로 안내 */
const NO_CRANK_PACKET_HINT = 5;

const NO_CRANK_MESSAGE =
  "이 센서에서 크랭크 데이터가 오지 않습니다 — 센서가 CSC 케이던스 모드인지 확인해 주세요.";
const NO_CSC_SERVICE_MESSAGE =
  "선택한 기기에 CSC 서비스가 없습니다 — 센서가 CSC 케이던스 모드인지 확인해 주세요.";
const DISCONNECTED_MESSAGE = "센서 연결이 끊겼습니다.";
const AUTO_RECONNECT_MESSAGE =
  "센서를 기다리는 중입니다 — 페달을 돌리면 자동으로 다시 연결합니다.";

type ConnectionAttemptResult = "connected" | "missing-csc" | "retryable";

class MissingCscServiceError extends Error {}

export type { BleCrankRpmUiState };

export type UseBleCrankRpmResult = {
  /** `navigator.bluetooth` 사용 가능(주로 Chromium·보안 출처) */
  capable: boolean;
  uiState: BleCrankRpmUiState;
  errorMessage: string | null;
  /** `null`=유효 샘플 없음 · `0`=연결됐으나 페달 정지 · `>0`=유효 케이던스 */
  crankRpm: number | null;
  deviceLabel: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

function isBluetoothCapable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

/**
 * Web Bluetooth CSC 크랭크 케이던스 — 권한·GATT·알림 생명주기만 담당한다.
 * 패킷 해석·rollover·정지 판정은 `lib/bleCscCadence` 의 순수 로직이 한다.
 *
 * 주행 세션과 분리돼 있다 — 주행 전에 연결해 확인하고, 주행이 끝나도 같은 앱
 * 세션에서 연결이 유지된다. 정리는 명시적 해제·unmount·페이지 종료에서만.
 */
export function useBleCrankRpm(): UseBleCrankRpmResult {
  const capable = isBluetoothCapable();
  const [uiState, setUiState] = useState<BleCrankRpmUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crankRpm, setCrankRpm] = useState<number | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const onGattDisconnectedRef = useRef<(() => void) | null>(null);
  const trackerRef = useRef(createCscCadenceTracker());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noCrankCountRef = useRef(0);
  const connectingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectLoopTokenRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const advertisementAbortRef = useRef<AbortController | null>(null);
  const advertisementDeviceRef = useRef<BluetoothDevice | null>(null);
  const advertisementHandlerRef = useRef<((event: BluetoothAdvertisingEvent) => void) | null>(null);
  const autoReconnectAllowedRef = useRef(false);
  const userDisconnectedRef = useRef(false);
  const resumeAfterPageShowRef = useRef(false);
  const onUnexpectedDisconnectRef = useRef<(device: BluetoothDevice) => void>(() => {});

  const onMeasurement = useCallback((ev: Event) => {
    const ch = ev.target as BluetoothRemoteGATTCharacteristic;
    const buf = ch.value;
    if (!buf) return;

    // 크랭크 필드가 계속 없으면 휠 전용·비 CSC 모드다 — 무한 대기 대신 안내한다.
    if (parseCscCrankSample(buf) == null) {
      noCrankCountRef.current += 1;
      if (noCrankCountRef.current === NO_CRANK_PACKET_HINT) setErrorMessage(NO_CRANK_MESSAGE);
      return;
    }
    if (noCrankCountRef.current !== 0) {
      noCrankCountRef.current = 0;
      setErrorMessage(null);
    }
    setCrankRpm(trackerRef.current.ingest(buf, Date.now()));
  }, []);

  /** GATT 세션 자원만 정리한다. 장치 권한/참조 보존 여부는 호출 측이 정한다. */
  const releaseGatt = useCallback((options?: { disconnectServer?: boolean; clearDevice?: boolean }) => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    const device = deviceRef.current;
    const onDisconnected = onGattDisconnectedRef.current;
    if (device && onDisconnected) {
      try {
        device.removeEventListener("gattserverdisconnected", onDisconnected);
      } catch {
        /* noop */
      }
    }
    onGattDisconnectedRef.current = null;

    const ch = charRef.current;
    if (ch) {
      try {
        ch.removeEventListener("characteristicvaluechanged", onMeasurement as EventListener);
      } catch {
        /* noop */
      }
      void ch.stopNotifications().catch(() => {});
    }
    charRef.current = null;

    const srv = serverRef.current;
    if (options?.disconnectServer && srv?.connected) {
      try {
        srv.disconnect();
      } catch {
        /* noop */
      }
    }
    serverRef.current = null;
    if (options?.clearDevice) deviceRef.current = null;
    trackerRef.current.reset(Date.now());
    noCrankCountRef.current = 0;
    connectingRef.current = false;
  }, [onMeasurement]);

  /** 광고 감시·백오프 타이머를 멈춘다. 자동 재연결 허용 자체는 호출 측이 정한다. */
  const stopAutoReconnect = useCallback(() => {
    reconnectLoopTokenRef.current += 1;
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const watchedDevice = advertisementDeviceRef.current;
    const handler = advertisementHandlerRef.current;
    if (watchedDevice && handler) {
      try {
        watchedDevice.removeEventListener("advertisementreceived", handler);
      } catch {
        /* noop */
      }
    }
    advertisementDeviceRef.current = null;
    advertisementHandlerRef.current = null;
    advertisementAbortRef.current?.abort();
    advertisementAbortRef.current = null;
    reconnectAttemptRef.current = 0;
    reconnectInFlightRef.current = false;
  }, []);

  /** chooser 없이 이미 허용된 장치에 GATT/CSC/notifications를 다시 구성한다. */
  const connectKnownDevice = useCallback(
    async (device: BluetoothDevice, automatic: boolean): Promise<ConnectionAttemptResult> => {
      if (connectingRef.current) return "retryable";

      releaseGatt({ disconnectServer: true, clearDevice: false });
      deviceRef.current = device;
      connectingRef.current = true;
      setDeviceLabel(device.name || "케이던스 센서");
      setCrankRpm(null);
      if (!automatic) {
        setErrorMessage(null);
        setUiState("connecting");
      }

      try {
        if (!device.gatt) throw new Error("이 장치는 Web Bluetooth GATT 연결을 지원하지 않습니다.");
        const server = await device.gatt.connect();
        serverRef.current = server;

        let characteristic: BluetoothRemoteGATTCharacteristic;
        try {
          const service = await server.getPrimaryService(CSC_SERVICE_UUID);
          characteristic = await service.getCharacteristic(CSC_MEASUREMENT_UUID);
        } catch {
          throw new MissingCscServiceError(NO_CSC_SERVICE_MESSAGE);
        }
        charRef.current = characteristic;
        characteristic.addEventListener("characteristicvaluechanged", onMeasurement);
        await characteristic.startNotifications();

        trackerRef.current.reset(Date.now());
        noCrankCountRef.current = 0;
        const onDisconnected = () => onUnexpectedDisconnectRef.current(device);
        onGattDisconnectedRef.current = onDisconnected;
        device.addEventListener("gattserverdisconnected", onDisconnected);

        stopAutoReconnect();
        setCrankRpm(null);
        setErrorMessage(null);
        setUiState("connected");
        pollTimerRef.current = setInterval(() => {
          setCrankRpm(trackerRef.current.pollStall(Date.now()));
        }, STALL_POLL_MS);
        return "connected";
      } catch (error) {
        const missingCsc = error instanceof MissingCscServiceError;
        releaseGatt({ disconnectServer: true, clearDevice: false });
        if (automatic) {
          setErrorMessage(AUTO_RECONNECT_MESSAGE);
          setUiState("disconnected");
        } else {
          setErrorMessage(
            missingCsc
              ? NO_CSC_SERVICE_MESSAGE
              : error instanceof Error
                ? error.message
                : "BLE 연결에 실패했습니다.",
          );
          setUiState("error");
        }
        return missingCsc ? "missing-csc" : "retryable";
      } finally {
        connectingRef.current = false;
      }
    },
    [onMeasurement, releaseGatt, stopAutoReconnect],
  );

  /**
   * 센서가 잠든 동안 광고를 기다리며, 광고 감시 미지원/누락에 대비해 지수 백오프도 병행한다.
   * 탭이 보이는 동안만 GATT 재시도를 수행한다.
   */
  const beginAutoReconnect = useCallback(
    (device: BluetoothDevice) => {
      stopAutoReconnect();
      if (!autoReconnectAllowedRef.current || userDisconnectedRef.current) return;

      deviceRef.current = device;
      setDeviceLabel(device.name || "케이던스 센서");
      setCrankRpm(null);
      setErrorMessage(AUTO_RECONNECT_MESSAGE);
      setUiState("disconnected");

      // 백그라운드 탭에서는 광고 스캔과 GATT 재시도를 시작하지 않는다.
      // 다시 보이는 순간 visibilitychange/pageshow가 같은 장치로 루프를 재개한다.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      const loopToken = reconnectLoopTokenRef.current;

      const schedule = (delayMs: number, attempt: () => Promise<void>) => {
        if (loopToken !== reconnectLoopTokenRef.current) return;
        if (reconnectTimerRef.current != null) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => void attempt(), delayMs);
      };

      const attempt = async () => {
        if (
          loopToken !== reconnectLoopTokenRef.current ||
          !autoReconnectAllowedRef.current ||
          userDisconnectedRef.current
        ) {
          return;
        }
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          schedule(1_000, attempt);
          return;
        }
        if (reconnectInFlightRef.current || connectingRef.current) {
          schedule(250, attempt);
          return;
        }

        if (reconnectTimerRef.current != null) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        reconnectInFlightRef.current = true;
        const result = await connectKnownDevice(device, true);
        reconnectInFlightRef.current = false;
        if (result === "connected") return;
        if (result === "missing-csc") {
          autoReconnectAllowedRef.current = false;
          stopAutoReconnect();
          setErrorMessage(NO_CSC_SERVICE_MESSAGE);
          setUiState("error");
          return;
        }
        const delay = bleReconnectDelayMs(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        schedule(delay, attempt);
      };

      // 센서를 움직여 광고가 다시 나오면 타이머를 기다리지 않고 즉시 시도한다.
      if (typeof device.watchAdvertisements === "function") {
        const controller = new AbortController();
        const onAdvertisement = () => void attempt();
        advertisementAbortRef.current = controller;
        advertisementDeviceRef.current = device;
        advertisementHandlerRef.current = onAdvertisement;
        device.addEventListener("advertisementreceived", onAdvertisement);
        void device.watchAdvertisements({ signal: controller.signal }).catch((error) => {
          if (!(error instanceof DOMException) || error.name !== "AbortError") {
            // watchAdvertisements 미지원·스캔 실패여도 아래 백오프 연결은 계속된다.
          }
        });
      }

      schedule(bleReconnectDelayMs(0), attempt);
    },
    [connectKnownDevice, stopAutoReconnect],
  );

  useEffect(() => {
    onUnexpectedDisconnectRef.current = (device) => {
      releaseGatt({ disconnectServer: false, clearDevice: false });
      setCrankRpm(null);
      setErrorMessage(DISCONNECTED_MESSAGE);
      setUiState("disconnected");
      if (autoReconnectAllowedRef.current && !userDisconnectedRef.current) {
        beginAutoReconnect(device);
      }
    };
    return () => {
      onUnexpectedDisconnectRef.current = () => {};
    };
  }, [beginAutoReconnect, releaseGatt]);

  /** 사용자의 명시적 연결 해제 — 현재 앱 세션에서는 자동 재연결하지 않는다. */
  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    autoReconnectAllowedRef.current = false;
    stopAutoReconnect();
    releaseGatt({ disconnectServer: true, clearDevice: true });
    setCrankRpm(null);
    setDeviceLabel(null);
    setErrorMessage(null);
    setUiState("idle");
  }, [releaseGatt, stopAutoReconnect]);

  const connect = useCallback(async () => {
    if (!capable || connectingRef.current) return;

    userDisconnectedRef.current = false;
    autoReconnectAllowedRef.current = true;
    stopAutoReconnect();

    // 같은 탭에서 한 번 선택한 장치는 chooser 없이 직접 다시 연결한다.
    const rememberedDevice = deviceRef.current;
    if (rememberedDevice) {
      const result = await connectKnownDevice(rememberedDevice, false);
      if (result === "retryable") beginAutoReconnect(rememberedDevice);
      return;
    }

    connectingRef.current = true;
    setErrorMessage(null);
    setCrankRpm(null);
    setUiState("connecting");
    try {
      // CSC UUID 를 광고하지 않는 센서(CYCPLUS 등)까지 잡되, 주변 모든 기기를
      // 노출하는 acceptAllDevices 는 쓰지 않는다.
      const device = await navigator.bluetooth!.requestDevice({
        filters: [{ services: [CSC_SERVICE_UUID] }, { namePrefix: "CYCPLUS" }],
        optionalServices: [CSC_SERVICE_UUID],
      });
      deviceRef.current = device;
      setDeviceLabel(device.name || "케이던스 센서");
      // chooser 진행 플래그를 내린 뒤 공통 GATT 연결 경로로 진입한다.
      connectingRef.current = false;
      const result = await connectKnownDevice(device, false);
      if (result === "retryable") beginAutoReconnect(device);
    } catch (e) {
      releaseGatt({ disconnectServer: true, clearDevice: true });
      autoReconnectAllowedRef.current = false;
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotFoundError") {
        // chooser 취소 — 오류가 아니다.
        setErrorMessage(null);
        setUiState("idle");
      } else if (name === "SecurityError") {
        setErrorMessage("보안 정책으로 BLE를 사용할 수 없습니다(HTTPS·localhost 필요).");
        setUiState("error");
      } else {
        setErrorMessage(e instanceof Error ? e.message : "BLE 연결에 실패했습니다.");
        setUiState("error");
      }
    } finally {
      connectingRef.current = false;
    }
  }, [beginAutoReconnect, capable, connectKnownDevice, releaseGatt, stopAutoReconnect]);

  /** 새 문서에서도 이 origin에 이미 허용된 장치를 chooser 없이 복원한다. */
  const restoreGrantedDevice = useCallback(async () => {
    if (!capable || userDisconnectedRef.current) return;
    const bluetooth = navigator.bluetooth;
    if (!bluetooth || typeof bluetooth.getDevices !== "function") return;
    try {
      const granted = await bluetooth.getDevices();
      if (userDisconnectedRef.current || deviceRef.current) return;
      const device = selectGrantedCadenceDevice(granted);
      if (!device) return;
      deviceRef.current = device;
      autoReconnectAllowedRef.current = true;
      setDeviceLabel(device.name || "케이던스 센서");
      beginAutoReconnect(device);
    } catch {
      // getDevices 미지원·권한 정책 차단은 수동 chooser 경로를 막지 않는다.
    }
  }, [beginAutoReconnect, capable]);

  /**
   * 앱 생명주기에서만 정리 — 주행 상태(idle/running)는 연결을 끊지 않는다.
   *
   * `pagehide` 는 GATT 를 실제로 끊으므로 React 상태도 함께 되돌린다. 그러지 않으면
   * BFCache 복귀 화면이 「연결됨 + 옛 RPM」으로 남아 실제 연결과 모순된다.
   * unmount cleanup 은 이벤트 경로와 달리 setState 하지 않는다(정리 중 상태 갱신 회피).
   */
  useEffect(() => {
    const onPageHide = () => {
      resumeAfterPageShowRef.current = Boolean(
        deviceRef.current && autoReconnectAllowedRef.current && !userDisconnectedRef.current,
      );
      stopAutoReconnect();
      releaseGatt({ disconnectServer: true, clearDevice: false });
      setCrankRpm(null);
      setErrorMessage(null);
      setUiState("idle");
    };
    const onPageShow = () => {
      if (userDisconnectedRef.current) return;
      const device = deviceRef.current;
      if (resumeAfterPageShowRef.current && device) {
        autoReconnectAllowedRef.current = true;
        beginAutoReconnect(device);
      } else if (!device) {
        void restoreGrantedDevice();
      }
      resumeAfterPageShowRef.current = false;
    };
    const onVisibilityChange = () => {
      const device = deviceRef.current;
      if (document.visibilityState === "hidden") {
        if (device && !device.gatt?.connected) stopAutoReconnect();
        return;
      }
      if (
        device &&
        !device.gatt?.connected &&
        autoReconnectAllowedRef.current &&
        !userDisconnectedRef.current
      ) {
        beginAutoReconnect(device);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const restoreTimer = window.setTimeout(() => void restoreGrantedDevice(), 0);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      autoReconnectAllowedRef.current = false;
      stopAutoReconnect();
      releaseGatt({ disconnectServer: true, clearDevice: true });
    };
  }, [beginAutoReconnect, releaseGatt, restoreGrantedDevice, stopAutoReconnect]);

  return {
    capable,
    uiState,
    errorMessage,
    crankRpm,
    deviceLabel,
    connect,
    disconnect,
  };
}
