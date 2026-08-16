import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { FirestoreError } from "firebase/firestore";
import { snapshotReadSubscriptions } from "../../src/lib/installReadSubscriptionDebug.ts";
import {
  debugInjectTrailLivePublicationRidesHubError,
  debugTrailLivePublicationRidesSubscriptionHub,
  acquireTrailLivePublicationRidesSubscription,
  resetTrailLivePublicationRidesSubscriptionHubForTests,
} from "../../src/lib/livePublicationRidesSubscriptionHub.ts";
import {
  resetUnderlyingReadMeters,
  snapshotUnderlyingReadSubscriptions,
  trackUnderlyingReadSubscription,
} from "../../src/lib/readSubscriptionMeters.ts";
import {
  acquireTrailMotionSubscription,
  debugInjectRtdbMotionHubError,
  debugRtdbMotionSubscriptionHub,
  resetRtdbMotionSubscriptionHubForTests,
} from "../../src/lib/rtdbMotionSubscriptionHub.ts";
import type { RtdbTrailMotionRow } from "../../src/lib/rtdbTrailMotion.ts";
import type { TrailLivePublicationRideRow } from "../../src/lib/firestoreTrailLivePublicationRides.ts";
import {
  acquireActiveLiveRideTrailIdsSubscription,
  debugActiveLiveRideTrailIdsSubscriptionHub,
  debugInjectActiveLiveRideTrailIdsHubError,
  resetActiveLiveRideTrailIdsSubscriptionHubForTests,
} from "../../src/lib/activeLiveRideTrailIdsSubscriptionHub.ts";


describe("readSubscriptionMeters", () => {
  beforeEach(() => {
    resetUnderlyingReadMeters();
  });

  it("open / openTotal / closeTotal 이 개시·해지에 맞춰 증감한다", () => {
    const unsub = trackUnderlyingReadSubscription("collectionGroup", () => {});
    const opened = snapshotUnderlyingReadSubscriptions();
    assert.equal(opened.collectionGroup.open, 1);
    assert.equal(opened.collectionGroup.openTotal, 1);
    assert.equal(opened.collectionGroup.closeTotal, 0);
    assert.ok(opened.collectionGroup.open >= 1, "계측이 살아 있음 — open 이 비-0");

    unsub();
    const closed = snapshotUnderlyingReadSubscriptions();
    assert.equal(closed.collectionGroup.open, 0);
    assert.equal(closed.collectionGroup.openTotal, 1);
    assert.equal(closed.collectionGroup.closeTotal, 1);
    assert.equal(closed.totalsAreCumulative, true);
    assert.equal(closed.compareStatesUsing, "open");
  });

  it("이중 unsub 는 무해하고 closeTotal 을 두 번 올리지 않는다", () => {
    const unsub = trackUnderlyingReadSubscription("rtdbOnValue", () => {});
    unsub();
    unsub();
    const snap = snapshotUnderlyingReadSubscriptions();
    assert.equal(snap.rtdbOnValue.open, 0);
    assert.equal(snap.rtdbOnValue.closeTotal, 1);
  });

  it("open 은 음수로 가지 않는다", () => {
    const unsub = trackUnderlyingReadSubscription("trailOnSnapshot", () => {});
    unsub();
    unsub();
    unsub();
    assert.equal(snapshotUnderlyingReadSubscriptions().trailOnSnapshot.open, 0);
  });
});

function trackedMotionSubscribe() {
  return (
    _trailId: string,
    onRows: (rows: RtdbTrailMotionRow[]) => void,
    _onError?: (err: Error) => void,
  ) => {
    onRows([]);
    return trackUnderlyingReadSubscription("rtdbOnValue", () => {});
  };
}

function trackedRidesSubscribe() {
  return (
    _trailId: string,
    onRows: (rows: TrailLivePublicationRideRow[]) => void,
    _onError?: (err: FirestoreError) => void,
  ) => {
    onRows([]);
    return trackUnderlyingReadSubscription("trailOnSnapshot", () => {});
  };
}

describe("rtdbMotionSubscriptionHub", () => {
  beforeEach(() => {
    resetUnderlyingReadMeters();
    resetRtdbMotionSubscriptionHubForTests(trackedMotionSubscribe());
  });

  afterEach(() => {
    resetRtdbMotionSubscriptionHubForTests();
    resetUnderlyingReadMeters();
  });

  it("consumer 2개여도 underlyingOpen 1, 마지막 release 에서만 unsubCallTotal +1", () => {
    const a = acquireTrailMotionSubscription("trail-a", () => {}, () => {});
    const b = acquireTrailMotionSubscription("trail-a", () => {}, () => {});
    const mid = debugRtdbMotionSubscriptionHub();
    assert.equal(mid.slotCount, 1);
    assert.equal(mid.slots[0]?.consumers, 2);
    assert.equal(mid.slots[0]?.underlyingOpen, true);
    assert.equal(snapshotUnderlyingReadSubscriptions().rtdbOnValue.open, 1);
    assert.equal(mid.unsubCallTotal, 0);

    a();
    const afterOne = debugRtdbMotionSubscriptionHub();
    assert.equal(afterOne.slotCount, 1);
    assert.equal(afterOne.unsubCallTotal, 0);
    assert.equal(snapshotUnderlyingReadSubscriptions().rtdbOnValue.open, 1);

    b();
    const afterAll = debugRtdbMotionSubscriptionHub();
    assert.equal(afterAll.slotCount, 0);
    assert.equal(afterAll.unsubCallTotal, 1);
    assert.equal(snapshotUnderlyingReadSubscriptions().rtdbOnValue.open, 0);
    assert.equal(snapshotUnderlyingReadSubscriptions().rtdbOnValue.closeTotal, 1);
    assert.equal(
      afterAll.unsubCallTotal,
      snapshotUnderlyingReadSubscriptions().rtdbOnValue.closeTotal,
    );
  });

  it("주입 오류는 injectedFanoutHits 만 올리고 errorFanoutHits 는 건드리지 않는다", () => {
    const hits: string[] = [];
    const release = acquireTrailMotionSubscription("trail-b", () => {}, (err) => {
      hits.push(err.message);
    });
    const n = debugInjectRtdbMotionHubError("inject-motion");
    const snap = debugRtdbMotionSubscriptionHub();
    assert.equal(n, 1);
    assert.deepEqual(hits, ["inject-motion"]);
    assert.equal(snap.injectedFanoutHits, 1);
    assert.equal(snap.errorFanoutHits, 0);
    release();
  });

  it("실제 underlying 오류는 errorFanoutHits 로만 센다", () => {
    resetRtdbMotionSubscriptionHubForTests(
      (_trailId, onRows, onError) => {
        onRows([]);
        onError?.(new Error("real-motion"));
        return trackUnderlyingReadSubscription("rtdbOnValue", () => {});
      },
    );
    const hits: string[] = [];
    const release = acquireTrailMotionSubscription("trail-c", () => {}, (err) => {
      hits.push(err.message);
    });
    const snap = debugRtdbMotionSubscriptionHub();
    assert.deepEqual(hits, ["real-motion"]);
    assert.equal(snap.errorFanoutHits, 1);
    assert.equal(snap.injectedFanoutHits, 0);
    release();
  });
});

describe("livePublicationRidesSubscriptionHub", () => {
  beforeEach(() => {
    resetUnderlyingReadMeters();
    resetTrailLivePublicationRidesSubscriptionHubForTests(trackedRidesSubscribe());
  });

  afterEach(() => {
    resetTrailLivePublicationRidesSubscriptionHubForTests();
    resetUnderlyingReadMeters();
  });

  it("consumer 2개여도 underlyingOpen 1, 마지막 release 에서만 unsubCallTotal +1", () => {
    const a = acquireTrailLivePublicationRidesSubscription("trail-a", () => {}, () => {});
    const b = acquireTrailLivePublicationRidesSubscription("trail-a", () => {}, () => {});
    const mid = debugTrailLivePublicationRidesSubscriptionHub();
    assert.equal(mid.slotCount, 1);
    assert.equal(mid.slots[0]?.consumers, 2);
    assert.equal(mid.slots[0]?.underlyingOpen, true);
    assert.equal(snapshotUnderlyingReadSubscriptions().trailOnSnapshot.open, 1);
    assert.equal(mid.unsubCallTotal, 0);

    a();
    assert.equal(debugTrailLivePublicationRidesSubscriptionHub().unsubCallTotal, 0);
    b();
    const afterAll = debugTrailLivePublicationRidesSubscriptionHub();
    assert.equal(afterAll.slotCount, 0);
    assert.equal(afterAll.unsubCallTotal, 1);
    assert.equal(snapshotUnderlyingReadSubscriptions().trailOnSnapshot.closeTotal, 1);
    assert.equal(
      afterAll.unsubCallTotal,
      snapshotUnderlyingReadSubscriptions().trailOnSnapshot.closeTotal,
    );
  });

  it("주입 오류는 injectedFanoutHits 만 올린다", () => {
    const hits: string[] = [];
    const release = acquireTrailLivePublicationRidesSubscription("trail-b", () => {}, (err) => {
      hits.push(err.message);
    });
    const n = debugInjectTrailLivePublicationRidesHubError("inject-rides");
    const snap = debugTrailLivePublicationRidesSubscriptionHub();
    assert.equal(n, 1);
    assert.deepEqual(hits, ["inject-rides"]);
    assert.equal(snap.injectedFanoutHits, 1);
    assert.equal(snap.errorFanoutHits, 0);
    release();
  });
});

describe("crossCheck hub unsub vs underlying close", () => {
  beforeEach(() => {
    resetUnderlyingReadMeters();
    resetRtdbMotionSubscriptionHubForTests(trackedMotionSubscribe());
    resetTrailLivePublicationRidesSubscriptionHubForTests(trackedRidesSubscribe());
  });

  afterEach(() => {
    resetRtdbMotionSubscriptionHubForTests();
    resetTrailLivePublicationRidesSubscriptionHubForTests();
    resetUnderlyingReadMeters();
  });

  it("해지 후 motion·rides 교차 검산이 통과한다", () => {
    const m = acquireTrailMotionSubscription("t1", () => {}, () => {});
    const r = acquireTrailLivePublicationRidesSubscription("t1", () => {}, () => {});
    m();
    r();
    const snap = snapshotReadSubscriptions();
    assert.equal(snap.crossCheck.motionUnsubCallTotalEqualsRtdbOnValueCloseTotal, true);
    assert.equal(snap.crossCheck.ridesUnsubCallTotalEqualsTrailOnSnapshotCloseTotal, true);
    assert.equal(snap.crossCheck.ok, true);
  });
});

function trackedCgSubscribe() {
  return (
    onIds: (ids: string[]) => void,
    _onError?: (err: FirestoreError) => void,
  ) => {
    onIds([]);
    return trackUnderlyingReadSubscription("collectionGroup", () => {});
  };
}

describe("activeLiveRideTrailIdsSubscriptionHub", () => {
  beforeEach(() => {
    resetUnderlyingReadMeters();
    resetActiveLiveRideTrailIdsSubscriptionHubForTests(trackedCgSubscribe());
  });

  afterEach(() => {
    resetActiveLiveRideTrailIdsSubscriptionHubForTests();
    resetUnderlyingReadMeters();
  });

  it("consumer 2??? underlyingOpen 1, ??? release ??? unsubCallTotal +1", () => {
    const a = acquireActiveLiveRideTrailIdsSubscription(() => {}, () => {});
    const b = acquireActiveLiveRideTrailIdsSubscription(() => {}, () => {});
    const mid = debugActiveLiveRideTrailIdsSubscriptionHub();
    assert.equal(mid.consumers, 2);
    assert.equal(mid.underlyingOpen, true);
    assert.equal(snapshotUnderlyingReadSubscriptions().collectionGroup.open, 1);
    assert.equal(mid.unsubCallTotal, 0);
    a();
    assert.equal(debugActiveLiveRideTrailIdsSubscriptionHub().unsubCallTotal, 0);
    assert.equal(snapshotUnderlyingReadSubscriptions().collectionGroup.open, 1);
    b();
    const afterAll = debugActiveLiveRideTrailIdsSubscriptionHub();
    assert.equal(afterAll.consumers, 0);
    assert.equal(afterAll.unsubCallTotal, 1);
    assert.equal(snapshotUnderlyingReadSubscriptions().collectionGroup.closeTotal, 1);
    assert.equal(afterAll.unsubCallTotal, snapshotUnderlyingReadSubscriptions().collectionGroup.closeTotal);
  });

  it("?? ??? injectedFanoutHits ? ??? ? consumer ??? ?? consumer ? ?? ???", () => {
    const hitsA: string[] = [];
    const hitsB: string[] = [];
    const a = acquireActiveLiveRideTrailIdsSubscription(() => {}, (err) => { hitsA.push(err.message); });
    const b = acquireActiveLiveRideTrailIdsSubscription(() => {}, (err) => { hitsB.push(err.message); });
    const n = debugInjectActiveLiveRideTrailIdsHubError("inject-cg");
    assert.equal(n, 2);
    assert.deepEqual(hitsA, ["inject-cg"]);
    assert.deepEqual(hitsB, ["inject-cg"]);
    a();
    assert.equal(debugActiveLiveRideTrailIdsSubscriptionHub().underlyingOpen, true);
    assert.equal(snapshotUnderlyingReadSubscriptions().collectionGroup.open, 1);
    const n2 = debugInjectActiveLiveRideTrailIdsHubError("inject-cg-2");
    assert.equal(n2, 1);
    assert.deepEqual(hitsB, ["inject-cg", "inject-cg-2"]);
    b();
  });
});

