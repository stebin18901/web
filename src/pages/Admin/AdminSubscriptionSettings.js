import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { SUBSCRIPTION_PLANS, DEFAULT_PRICING } from "../../config/subscriptionConfig";
import "./AdminSubscriptionSettings.css";

const AdminSubscriptionSettings = () => {
  const [schoolId, setSchoolId] = useState("default");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [discountBanner, setDiscountBanner] = useState("");
  const [popularPlan, setPopularPlan] = useState("yearly");

  // Price states
  const [quarterlyPrice, setQuarterlyPrice] = useState(DEFAULT_PRICING.quarterly);
  const [halfYearlyPrice, setHalfYearlyPrice] = useState(DEFAULT_PRICING.half_yearly);
  const [yearlyPrice, setYearlyPrice] = useState(DEFAULT_PRICING.yearly);

  // Fetch existing settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const settingsRef = doc(db, "subscriptionSettings", schoolId);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setQuarterlyPrice(data.quarterlyPrice || DEFAULT_PRICING.quarterly);
          setHalfYearlyPrice(data.halfYearlyPrice || DEFAULT_PRICING.half_yearly);
          setYearlyPrice(data.yearlyPrice || DEFAULT_PRICING.yearly);
          setCurrency(data.currency || "INR");
          setDiscountBanner(data.discountBanner || "");
          setPopularPlan(data.popularPlan || "yearly");
        }

        setError("");
        setLoading(false);
      } catch (err) {
        console.error("Error fetching settings:", err);
        setError("Failed to load subscription settings");
        setLoading(false);
      }
    };

    fetchSettings();
  }, [schoolId]);

  const handleSave = async (e) => {
    e.preventDefault();

    // Validation
    if (quarterlyPrice < 10 || halfYearlyPrice < 10 || yearlyPrice < 10) {
      setError("Prices must be at least ₹10");
      return;
    }

    if (!["quarterly", "half_yearly", "yearly"].includes(popularPlan)) {
      setError("Please select a valid popular plan");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const settingsRef = doc(db, "subscriptionSettings", schoolId);
      await setDoc(
        settingsRef,
        {
          schoolId,
          quarterlyPrice: parseFloat(quarterlyPrice),
          halfYearlyPrice: parseFloat(halfYearlyPrice),
          yearlyPrice: parseFloat(yearlyPrice),
          currency,
          discountBanner: discountBanner || null,
          popularPlan,
          updatedAt: new Date().toISOString(),
          updatedBy: "admin",
        },
        { merge: true }
      );

      setSuccess("✅ Subscription settings saved successfully!");
      setSaving(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save subscription settings");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-subscription-settings">
        <div className="settings-loader">
          <div className="loader-circle"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-subscription-settings">
      <div className="settings-container">
        <div className="settings-header">
          <h2>💳 Subscription Settings</h2>
          <p>Configure pricing for subscription plans</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSave} className="settings-form">
          {/* School Selection */}
          <div className="form-section">
            <label className="form-label">School ID</label>
            <input
              type="text"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              placeholder="default"
              className="form-input"
            />
            <p className="form-help">Use "default" for platform-wide settings</p>
          </div>

          {/* Currency Selection */}
          <div className="form-section">
            <label className="form-label">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="form-select"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div className="divider" />

          {/* Pricing Cards */}
          <div className="pricing-cards">
            {/* Quarterly */}
            <div className="price-card">
              <div className="price-header">
                <h4>{SUBSCRIPTION_PLANS.QUARTERLY.name}</h4>
                <p className="price-duration">{SUBSCRIPTION_PLANS.QUARTERLY.badge}</p>
              </div>
              <div className="price-input-group">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={quarterlyPrice}
                  onChange={(e) => setQuarterlyPrice(e.target.value)}
                  className="price-input"
                />
              </div>
              <p className="price-monthly">
                ₹{(quarterlyPrice / 3).toFixed(0)}/month
              </p>
            </div>

            {/* Half Yearly */}
            <div className="price-card">
              <div className="price-header">
                <h4>{SUBSCRIPTION_PLANS.HALF_YEARLY.name}</h4>
                <p className="price-duration">{SUBSCRIPTION_PLANS.HALF_YEARLY.badge}</p>
              </div>
              <div className="price-input-group">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={halfYearlyPrice}
                  onChange={(e) => setHalfYearlyPrice(e.target.value)}
                  className="price-input"
                />
              </div>
              <p className="price-monthly">
                ₹{(halfYearlyPrice / 6).toFixed(0)}/month
              </p>
            </div>

            {/* Yearly */}
            <div className="price-card">
              <div className="price-header">
                <h4>{SUBSCRIPTION_PLANS.YEARLY.name}</h4>
                <p className="price-duration">{SUBSCRIPTION_PLANS.YEARLY.badge}</p>
              </div>
              <div className="price-input-group">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(e.target.value)}
                  className="price-input"
                />
              </div>
              <p className="price-monthly">
                ₹{(yearlyPrice / 12).toFixed(0)}/month
              </p>
            </div>
          </div>

          <div className="divider" />

          {/* Popular Plan Selection */}
          <div className="form-section">
            <label className="form-label">⭐ Popular Plan (Show "Best Value" Badge)</label>
            <div className="radio-group">
              {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
                <label key={plan.id} className="radio-label">
                  <input
                    type="radio"
                    name="popularPlan"
                    value={plan.id}
                    checked={popularPlan === plan.id}
                    onChange={(e) => setPopularPlan(e.target.value)}
                    className="radio-input"
                  />
                  <span>{plan.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Discount Banner */}
          <div className="form-section">
            <label className="form-label">📢 Discount Banner (Optional)</label>
            <input
              type="text"
              value={discountBanner}
              onChange={(e) => setDiscountBanner(e.target.value)}
              placeholder="e.g., 'Limited Time: 20% off yearly plans'"
              className="form-input"
            />
            <p className="form-help">
              Leave empty to hide discount banner
            </p>
          </div>

          {/* Price Comparison */}
          <div className="price-comparison">
            <h4>💰 Price Comparison</h4>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duration</th>
                  <th>Total Price</th>
                  <th>Per Month</th>
                  <th>Savings vs Quarterly</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="plan-name">
                    {SUBSCRIPTION_PLANS.QUARTERLY.name}
                  </td>
                  <td>3 months</td>
                  <td className="price">₹{quarterlyPrice}</td>
                  <td>₹{(quarterlyPrice / 3).toFixed(0)}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td className="plan-name">
                    {SUBSCRIPTION_PLANS.HALF_YEARLY.name}
                  </td>
                  <td>6 months</td>
                  <td className="price">₹{halfYearlyPrice}</td>
                  <td>₹{(halfYearlyPrice / 6).toFixed(0)}</td>
                  <td className="savings">
                    {(
                      ((quarterlyPrice * 2 - halfYearlyPrice) /
                        (quarterlyPrice * 2)) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                </tr>
                <tr>
                  <td className="plan-name">
                    {SUBSCRIPTION_PLANS.YEARLY.name}
                  </td>
                  <td>12 months</td>
                  <td className="price">₹{yearlyPrice}</td>
                  <td>₹{(yearlyPrice / 12).toFixed(0)}</td>
                  <td className="savings">
                    {(
                      ((quarterlyPrice * 4 - yearlyPrice) /
                        (quarterlyPrice * 4)) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-reset"
              onClick={() => {
                setQuarterlyPrice(DEFAULT_PRICING.quarterly);
                setHalfYearlyPrice(DEFAULT_PRICING.half_yearly);
                setYearlyPrice(DEFAULT_PRICING.yearly);
                setPopularPlan("yearly");
                setDiscountBanner("");
              }}
              disabled={saving}
            >
              Reset to Defaults
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={saving}
            >
              {saving ? "Saving..." : "💾 Save Settings"}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="info-box">
          <h4>ℹ️ Important Notes</h4>
          <ul>
            <li>Changes reflect instantly on the pricing page</li>
            <li>Use different school IDs for school-specific pricing</li>
            <li>Minimum price: ₹10</li>
            <li>All prices are in INR unless changed</li>
            <li>Users with active subscriptions keep their plan</li>
            <li>New subscriptions use the updated pricing</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminSubscriptionSettings;
