import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAppHudValues, type AppHudValuesInput } from '../../src/app/appHudValues.ts';
import type { RideEndResult } from '../../src/lib/ride/rideEndResult.ts';

const ended: RideEndResult = {
  recordId:'ended',endedAtIso:'2026-11-19T00:00:00Z',sessionDistanceMeters:1000,
  elapsedSec:180,avgSpeedKmh:20,caloriesEstimate:null,savedRouteId:'saved',routeName:'route',
  hasRoute:true,previousProgressRatio:.5,progressRatio:.7,routeCompleted:false,
  anchorLngLat:null,anchorPlaceLabel:null,profile:'cycling',routeDistanceMeters:10000,
  startPlaceLabel:'출발 주소',endPlaceLabel:'도착 주소',
  hudSnapshot:{cumulativeDistanceMeters:6000,speedKmh:22,newRoadMeters:450},
};
const input: AppHudValuesInput = {
  rideMetrics:{virtualDistanceMeters:0,accumulatedMs:0,liveLngLat:null,appliedSpeedKmh:0},
  sessionStartOffsetMeters:0,startPlaceLabel:null,endPlaceLabel:null,lastEndedWasAdhoc:null,
  routeDistanceMeters:0,rideStatus:'idle',routeGeometry:null,summaryVisible:true,
  lastRideResult:ended,avgSpeedLabel:'0.0',
};

test('종료 후 초기화된 실시간 값 대신 마지막 계기를 표시하며 기존 진행률이 더 커도 누적 위치를 바꾸지 않는다',()=>{
  assert.deepEqual(computeAppHudValues(input).hudMetrics,{
    mode:'ride',elapsed:'03:00',distanceKm:'1.00',cumulativeKm:'6.00',
    avgKmh:'20.0',speedKmh:22,routeTotalKm:'10.00',
  });
});
test('결과를 닫으면 남은 결과 객체가 있어도 종료 계기를 표시하지 않는다',()=>{
  assert.equal(computeAppHudValues({...input,summaryVisible:false}).hudMetrics,null);
});
test('일반 주행 중 계기 값 계산은 기존 실시간 입력을 사용한다',()=>{
  const metrics=computeAppHudValues({...input,summaryVisible:false,rideStatus:'running',
    rideMetrics:{virtualDistanceMeters:6500,accumulatedMs:90000,liveLngLat:null,appliedSpeedKmh:24.7},
    sessionStartOffsetMeters:5000,routeDistanceMeters:10000,avgSpeedLabel:'60.0',
  }).hudMetrics;
  assert.equal(metrics?.mode,'ride');
  assert.equal(metrics?.distanceKm,'1.50');
  assert.equal(metrics?.elapsed,'01:30');
  assert.equal(metrics?.mode==='ride'&&metrics.speedKmh,25);
});
