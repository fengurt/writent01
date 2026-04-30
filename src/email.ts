export interface RequestEmail {
  writerName: string;
  website: string;
  reason: string;
  submittedAt: string;
}

export async function sendRequestEmail(
  request: RequestEmail,
  sendingDomain: string,
  mailTo: string
): Promise<boolean> {
  if (!sendingDomain || !mailTo) {
    console.log('Email not configured — skipping notification');
    return false;
  }

  try {
    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: mailTo }] }],
        from: {
          email: `noreply@${sendingDomain}`,
          name: 'Writer Tracker'
        },
        subject: `Writer Tracker: New writer request — ${request.writerName}`,
        content: [
          {
            type: 'text/plain',
            value: [
              `New writer request:`,
              ``,
              `Writer:  ${request.writerName}`,
              `Website: ${request.website || 'Not provided'}`,
              `Reason:  ${request.reason || 'Not provided'}`,
              ``,
              `Submitted: ${request.submittedAt}`,
            ].join('\n')
          }
        ],
      }),
    });

    if (resp.ok) {
      console.log(`Email sent for request: ${request.writerName}`);
      return true;
    } else {
      const body = await resp.text();
      console.log(`Email failed: HTTP ${resp.status} — ${body}`);
      return false;
    }
  } catch (e: any) {
    console.log(`Email error: ${e.message}`);
    return false;
  }
}
