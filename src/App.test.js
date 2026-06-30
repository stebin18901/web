import {
  calculateExpiryDate,
  getPlanById,
  getSubscriptionPricingFromSettings,
  getVisibleSubscriptionPlans,
} from "./config/subscriptionConfig";

describe("subscriptionConfig", () => {
  test("falls back to yearly plan for unknown ids", () => {
    expect(getPlanById("unknown-plan").id).toBe("yearly");
  });

  test("maps pricing settings with defaults", () => {
    expect(
      getSubscriptionPricingFromSettings({
        quarterlyPrice: "700",
        yearlyPrice: 1999,
      })
    ).toEqual({
      weekly_test: 1,
      quarterly: 700,
      half_yearly: 990,
      yearly: 1999,
    });
  });

  test("hides the test plan unless explicitly enabled", () => {
    expect(getVisibleSubscriptionPlans({}).map((plan) => plan.id)).toEqual([
      "quarterly",
      "half_yearly",
      "yearly",
    ]);

    expect(
      getVisibleSubscriptionPlans({ testPlanEnabled: true }).map((plan) => plan.id)
    ).toContain("weekly_test");
  });

  test("calculates expiry date using plan duration", () => {
    const startDate = "2026-01-01T00:00:00.000Z";
    expect(calculateExpiryDate(startDate, "weekly_test").toISOString()).toContain(
      "2026-01-09"
    );
  });
});
