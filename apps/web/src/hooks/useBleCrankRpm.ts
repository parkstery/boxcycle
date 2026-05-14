import { useCallback, useEffect, useRef, useState } from "react";

const CSC_SERVICE_UUID = "00001816-0000-1000-8000-00805f9b34fb";
const CSC_MEASUREMENT_UUID = "00002a5b-0000-1000-8000-00805f9b34fb";

const FLAG_WHEEL_REV = 1;
const FLAG_CRANK_REV = 2;

const STALE_MS = 3500;
const RPM_EMA_ALPHA = 0.35;

export type BleCrankRpmUiState = "idle" | "connecting" | "connected" | "error";

export type UseBleCrankRpmOptions = {
  /** false이면 GATT 연결을 끊고 알림을 중단한다(세션 종료·대기 등) */
  sessionActive: boolean;
};

export type UseBleCrankRpmResult = {
  /** `navigator.bluetooth` 사용 가능(주로 Chromium·보안 출처) */
  capable: boolean;
  uiState: BleCrankRpmUiState;
  errorMessage: string | null;
  crankRpm: number | null;
  deviceLabel: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

function isBluetoothCapable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

function parseCrankSample(dataView: DataView): { revs: number; time1024: number } | null {
  if (dataView.byteLength < 1) return null;
  const flags = dataView.getUint8(0);
  let o = 1;
  if (flags & FLAG_WHEEL_REV) {
    if (dataView.byteLength < o + 6) return null;
    o += 6;
  }
  if (flags & FLAG_CRANK_REV) {
    if (dataView.byteLength < o + 4) return null;
    const revs = dataView.getUint16(o, true);
    const time1024 = dataView.getUint16(o + 2, true);
    return { revs, time1024 };
  }
  return null;
}

function u16Delta(cur: number, prev: number): number {
  let d = cur - prev;
  if (d < 0) d += 65536;
  return d;
}

/**
 * Web Bluetooth CSC(Cycling Speed and Cadence)에서 크랭크 RPM을 산출한다.
 * 휠만 있는 센서는 `crankRpm`을 채우지 않는다.
 */
export function useBleCrankRpm(opts: UseBleCrankRpmOptions): UseBleCrankRpmResult {
  const capable = isBluetoothCapable();
  const [uiState, setUiState] = useState<BleCrankRpmUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crankRpm, setCrankRpm] = useState<number | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const prevSampleRef = useRef<{ revs: number; time1024: number } | null>(null);
  const emaRpmRef = useRef<number | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventMsRef = useRef<number>(0);
  const connectingRef = useRef(false);

  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current != null) {
      clearInterval(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const onMeasurement = useCallback((ev: Event) => {
    const ch = ev.target as BluetoothRemoteGATTCharacteristic;
    const buf = ch.value;
    if (!buf) return;
    const sample = parseCrankSample(buf);
    if (!sample) return;

    const now = Date.now();
    lastEventMsRef.current = now;

    const prev = prevSampleRef.current;
    prevSampleRef.current = sample;

    if (!prev) return;

    const dRev = u16Delta(sample.revs, prev.revs);
    const dTime = u16Delta(sample.time1024, prev.time1024);
    const dtSec = dTime / 1024;
    if (dtSec < 0.08 || dRev < 1) return;

    const instant = (dRev / dtSec) * 60;
    if (!Number.isFinite(instant) || instant < 0 || instant > 220) return;

    const prevEma = emaRpmRef.current;
    const nextEma =
      prevEma == null ? instant : prevEma * (1 - RPM_EMA_ALPHA) + instant * RPM_EMA_ALPHA;
    emaRpmRef.current = nextEma;
    setCrankRpm(nextEma);
  }, []);

  /** GATT·타이머만 정리(UI 메시지는 건드리지 않음) */
  const cleanupGatt = useCallback(() => {
    clearStaleTimer();
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
    prevSampleRef.current = null;
    emaRpmRef.current = null;
    lastEventMsRef.current = 0;
    connectingRef.current = false;
    setCrankRpm(null);
    setDeviceLabel(null);
  }, [clearStaleTimer, onMeasurement]);

  const disconnect = useCallback(() => {
    cleanupGatt();
    setUiState("idle");
    setErrorMessage(null);
  }, [cleanupGatt]);

  const connect = useCallback(async () => {
    if (!capable || connectingRef.current) return;
    connectingRef.current = true;
    setErrorMessage(null);
    setUiState("connecting");

    try {
      const device = await navigator.bluetooth!.requestDevice({
        filters: [{ services: [CSC_SERVICE_UUID] }],
        optionalServices: [CSC_SERVICE_UUID],
      });

      const server = await device.gatt!.connect();
      serverRef.current = server;

      const service = await server.getPrimaryService(CSC_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CSC_MEASUREMENT_UUID);
      charRef.current = characteristic;

      characteristic.addEventListener("characteristicvaluechanged", onMeasurement);
      await characteristic.startNotifications();

      setDeviceLabel(device.name || "CSC");
      setUiState("connected");
      prevSampleRef.current = null;
      emaRpmRef.current = null;
      lastEventMsRef.current = Date.now();

      clearStaleTimer();
      staleTimerRef.current = setInterval(() => {
        if (Date.now() - lastEventMsRef.current > STALE_MS) {
          emaRpmRef.current = null;
          setCrankRpm(null);
        }
      }, 800);

      const onDisconnect = () => {
        characteristic.removeEventListener("characteristicvaluechanged", onMeasurement as EventListener);
        disconnect();
      };
      device.addEventListener("gattserverdisconnected", onDisconnect, { once: true });
    } catch (e) {
      cleanupGatt();
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotFoundError") {
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
  }, [capable, cleanupGatt, clearStaleTimer, disconnect, onMeasurement]);

  useEffect(() => {
    if (!opts.sessionActive) {
      disconnect();
    }
  }, [opts.sessionActive, disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
