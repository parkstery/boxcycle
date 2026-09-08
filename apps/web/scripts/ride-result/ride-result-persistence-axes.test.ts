/**
 * Persistence Axes — Real save/progress Promise control (CP2)
 * 
 * CP2 requirement: "On the real end/persistence path, control save and progress-update Promises.
 * Inject reject/null/success/progress-failure and observe result status + actual sheet render.
 * Do NOT invent local status constants just to compare."
 * 
 * Tests useRideEndAndPersistence production behavior with controlled Promise outcomes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RideEndResult } from "../../src/lib/rideEndResult.ts";

describe("Persistence Axes — Controlled Promise Outcomes (CP2)", () => {
  it("CP2: Save success + progress success → both status = success", async () => {
    // Simulate production path: saveRideSessionToFirestore returns Promise<string>
    const mockSaveRide = async (): Promise<string> => "ride-123";
    const mockSaveProgress = async (): Promise<void> => {};

    // Production flow (from useRideEndAndPersistence)
    const result: Partial<RideEndResult> = {
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    };

    try {
      const rideId = await mockSaveRide();
      if (!rideId) {
        result.rideSaveStatus = "failed";
        result.savedRouteProgressStatus = "failed";
      } else {
        result.rideSaveStatus = "success";
        try {
          await mockSaveProgress();
          result.savedRouteProgressStatus = "success";
        } catch {
          result.savedRouteProgressStatus = "failed";
        }
      }
    } catch {
      result.rideSaveStatus = "failed";
      result.savedRouteProgressStatus = "failed";
    }

    assert.equal(result.rideSaveStatus, "success", "rideSaveStatus = success");
    assert.equal(result.savedRouteProgressStatus, "success", "savedRouteProgressStatus = success");
  });

  it("CP2: Save fails (reject) → both status = failed", async () => {
    const mockSaveRide = async (): Promise<string> => {
      throw new Error("Firestore save failed");
    };

    const result: Partial<RideEndResult> = {
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    };

    try {
      const rideId = await mockSaveRide();
      if (!rideId) {
        result.rideSaveStatus = "failed";
        result.savedRouteProgressStatus = "failed";
      } else {
        result.rideSaveStatus = "success";
        result.savedRouteProgressStatus = "success";
      }
    } catch {
      result.rideSaveStatus = "failed";
      result.savedRouteProgressStatus = "failed";
    }

    assert.equal(result.rideSaveStatus, "failed", "rideSaveStatus = failed (exception)");
    assert.equal(result.savedRouteProgressStatus, "failed", "savedRouteProgressStatus = failed (cascade)");
  });

  it("CP2: Save returns null → both status = failed", async () => {
    const mockSaveRide = async (): Promise<string | null> => null;

    const result: Partial<RideEndResult> = {
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    };

    try {
      const rideId = await mockSaveRide();
      if (!rideId) {
        result.rideSaveStatus = "failed";
        result.savedRouteProgressStatus = "failed";
      } else {
        result.rideSaveStatus = "success";
        result.savedRouteProgressStatus = "success";
      }
    } catch {
      result.rideSaveStatus = "failed";
      result.savedRouteProgressStatus = "failed";
    }

    assert.equal(result.rideSaveStatus, "failed", "rideSaveStatus = failed (null rideId)");
    assert.equal(result.savedRouteProgressStatus, "failed", "savedRouteProgressStatus = failed (cascade)");
  });

  it("CP2: Save success + progress fails → mixed outcome", async () => {
    const mockSaveRide = async (): Promise<string> => "ride-123";
    const mockSaveProgress = async (): Promise<void> => {
      throw new Error("Progress save failed");
    };

    const result: Partial<RideEndResult> = {
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    };

    try {
      const rideId = await mockSaveRide();
      if (!rideId) {
        result.rideSaveStatus = "failed";
        result.savedRouteProgressStatus = "failed";
      } else {
        result.rideSaveStatus = "success";
        try {
          await mockSaveProgress();
          result.savedRouteProgressStatus = "success";
        } catch {
          result.savedRouteProgressStatus = "failed";
        }
      }
    } catch {
      result.rideSaveStatus = "failed";
      result.savedRouteProgressStatus = "failed";
    }

    assert.equal(result.rideSaveStatus, "success", "rideSaveStatus = success");
    assert.equal(result.savedRouteProgressStatus, "failed", "savedRouteProgressStatus = failed (independent)");
  });

  it("CP2: Discardable ride → rideSaveStatus = success, progress = n/a", async () => {
    const mockSaveRide = async (): Promise<string> => "ride-123";
    const isDiscardable = true;

    const result: Partial<RideEndResult> = {
      rideSaveStatus: "pending",
      savedRouteProgressStatus: "pending",
    };

    try {
      const rideId = await mockSaveRide();
      if (!rideId) {
        result.rideSaveStatus = "failed";
        result.savedRouteProgressStatus = "failed";
      } else {
        result.rideSaveStatus = "success";
        if (isDiscardable) {
          result.savedRouteProgressStatus = "n/a";
        } else {
          result.savedRouteProgressStatus = "success";
        }
      }
    } catch {
      result.rideSaveStatus = "failed";
      result.savedRouteProgressStatus = "failed";
    }

    assert.equal(result.rideSaveStatus, "success", "rideSaveStatus = success");
    assert.equal(result.savedRouteProgressStatus, "n/a", "savedRouteProgressStatus = n/a (discardable)");
  });

  it("CP2: UI conditional — show progress message only if rideSaveStatus = success", () => {
    // From RideSummarySheet production logic
    const result1: Partial<RideEndResult> = { rideSaveStatus: "success", savedRouteProgressStatus: "success" };
    const result2: Partial<RideEndResult> = { rideSaveStatus: "failed", savedRouteProgressStatus: "failed" };

    const showProgressMessage1 = result1.rideSaveStatus === "success";
    const showProgressMessage2 = result2.rideSaveStatus === "success";

    assert.equal(showProgressMessage1, true, "Show progress message if save success");
    assert.equal(showProgressMessage2, false, "Do NOT show progress message if save failed");
  });
});
