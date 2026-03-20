// Step 5: Select Reply Target UUID
// Finds the most recent inbound email in the thread to use as the reply target.

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === "") return [];
  return String(v).split(",").map(s => s.trim());
};

// Fix: use trigger_eaccount (was incorrectly trigger_account)
const triggerAccount = (inputData.trigger_eaccount || "").toLowerCase().trim();
const triggerCampaign = (inputData.trigger_campaign_id || "").trim();

const ids = toArray(inputData.ids);
const fromEmails = toArray(inputData.from_emails);
const eaccounts = toArray(inputData.eaccounts);
const campaigns = toArray(inputData.campaign_ids);

let selected = "";
let matchedFromEmail = "";
let debugRows = [];

for (let i = ids.length - 1; i >= 0; i--) {
  const fromEmail = (fromEmails[i] || "").toLowerCase().trim();
  const account = (eaccounts[i] || "").toLowerCase().trim();
  const campaign = (campaigns[i] || "").trim();

  // inboundMatch: email was sent by the lead (not our own account)
  const inboundMatch = fromEmail !== triggerAccount;
  const accountMatch = account === triggerAccount;
  // Note: campaign matching removed — thread emails may belong to a different
  // campaign ID than the trigger (e.g. original vs. copied campaign), so
  // filtering by campaign caused no match. Account matching is sufficient.

  debugRows.push({
    i,
    id: ids[i] || "",
    from_email: fromEmail,
    account,
    campaign,
    inbound_match: inboundMatch,
    account_match: accountMatch,
    campaign_match: campaign === triggerCampaign
  });

  if (inboundMatch && accountMatch) {
    selected = ids[i];
    matchedFromEmail = fromEmail;
    break;
  }
}

return {
  reply_to_uuid: selected || "",
  matched_from_email: matchedFromEmail || "",
  debug_trigger_account: triggerAccount,
  debug_trigger_campaign: triggerCampaign,
  debug_rows: JSON.stringify(debugRows)
};
