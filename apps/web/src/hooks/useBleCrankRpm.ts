import { useCallback, useEffect, useRef, useState } from "react";
import {
  CSC_MEASUREMENT_UUID,
  CSC_SERVICE_UUID,
  createCscCadenceTracker,
  parseCscCrankSample,
} from "../lib/bleCscCadence";

/** 정지(0rpm) 판정을 위한 폴링 주기 — stall 임계보다 충분히 짧게 */
const STALL_POLL_MS = 400;
/** 크랭크 필드 없는 패킷이 이만큼 연속되면 「케이던스 모드 아님」으로 안내 */
const NO_CRANK_PACKET_HINT = 5;

const NO_CRANK_MESSAGE =
  "이 센서에서 크랭크 데이터가 오지 않습니다 — 센서가 CSC 케이던스 모드인지 확인해 주세요.";
const NO_CSC_SERVICE_MESSAGE =
  "선택한 기기에 CSC 서비스가 없습니다 — 센서가 CSC 케이던스 모드인지 확인해 주세요.";
const DISCONNECTED_MESSAGE = "센서 연결이 끊겼습니다.";

/**
 * - `idle`: 연결한 적 없음(또는 사용자가 명시적으로 해제)
 * - `connecting`: chooser·GATT 진행 중
 * - `connected`: 알림 수신 중
 * - `disconnected`: 연결됐다가 끊김 — 「다시 연결」 유도
 * - `error`: 연결 실패
 */
export type BleCrankRpmUiState = "idle" | "connecting" | "connected" | "disconnected" | "error";

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

  /** GATT·리스너·타이머만 정리한다(React 상태는 호출 측이 정한다) */
  const releaseGatt = useCallback(() => {
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
    if (srv?.connected) {
      try {
        srv.disconnect();
      } catch {
        /* noop */
      }
    }
    serverRef.current = null;
    deviceRef.current = null;
    trackerRef.current.reset(Date.now());
    noCrankCountRef.current = 0;
    connectingRef.current = false;
  }, [onMeasurement]);

  /** 사용자의 명시적 연결 해제 */
  const disconnect = useCallback(() => {
    releaseGatt();
    setCrankRpm(null);
    setDeviceLabel(null);
    setErrorMessage(null);
    setUiState("idle");
  }, [releaseGatt]);

  const connect = useCallback(async () => {
    if (!capable || connectingRef.current) return;
    // 다시 연결 — 이전 세션 잔여물이 남아 있으면 먼저 정리한다.
    releaseGatt();
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

      const server = await device.gatt!.connect();
      serverRef.current = server;

      let characteristic: BluetoothRemoteGATTCharacteristic;
      try {
        const service = await server.getPrimaryService(CSC_SERVICE_UUID);
        characteristic = await service.getCharacteristic(CSC_MEASUREMENT_UUID);
      } catch {
        releaseGatt();
        setDeviceLabel(device.name || null);
        setErrorMessage(NO_CSC_SERVICE_MESSAGE);
        setUiState("error");
        return;
      }
      charRef.current = characteristic;

      characteristic.addEventListener("characteristicvaluechanged", onMeasurement);
      await characteristic.startNotifications();

      trackerRef.current.reset(Date.now());
      noCrankCountRef.current = 0;
      setCrankRpm(null);
      setDeviceLabel(device.name || "케이던스 센서");
      setUiState("connected");

      pollTimerRef.current = setInterval(() => {
        setCrankRpm(trackerRef.current.pollStall(Date.now()));
      }, STALL_POLL_MS);

      const onDisconnected = () => {
        releaseGatt();
        setCrankRpm(null);
        setErrorMessage(DISCONNECTED_MESSAGE);
        setUiState("disconnected");
      };
      onGattDisconnectedRef.current = onDisconnected;
      device.addEventListener("gattserverdisconnected", onDisconnected);
    } catch (e) {
      releaseGatt();
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
  }, [capable, onMeasurement, releaseGatt]);

  /** 앱 생명주기에서만 정리 — 주행 상태(idle/running)는 연결을 끊지 않는다 */
  useEffect(() => {
    const onPageHide = () => releaseGatt();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      releaseGatt();
    };
  }, [releaseGatt]);

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
