// Stretch feature: email the reporter when a report is verified or resolved (EmailJS REST API).
// Does nothing unless all EMAILJS_* variables are set. Never blocks or fails the request.
async function notifyStatus(report, user) {
  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) return;
  if (!user || !user.email || !['verified', 'resolved'].includes(report.status)) return;
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_email: user.email,
          to_name: user.name || 'neighbor',
          report_status: report.status,
          report_barangay: report.barangay,
          report_description: report.description,
          status_reason: report.statusReason || ''
        }
      })
    });
    if (!res.ok) console.error('EmailJS error', res.status, await res.text());
  } catch (e) {
    console.error('EmailJS failed:', e.message);
  }
}
module.exports = { notifyStatus };
