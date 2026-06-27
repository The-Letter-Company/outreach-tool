import { EmailTemplate } from '@/types'

export const templates: EmailTemplate[] = [
  {
    id: '1',
    name: 'Blog Reader',
    subject: "Quick note re: [Company]'s content",
    body: `Hi [FirstName],

I've been reading [Company]'s blog — [write one specific observation about a recent post here].

We help editorial teams turn their existing content into a growth channel. Happy to share what's worked for teams like yours.

[VIDEO]

Worth a quick call?

[Sender]`,
  },
  {
    id: '2',
    name: 'Funding Angle',
    subject: 'Congrats on the raise, [FirstName]',
    body: `Hi [FirstName],

Congrats on the recent round — exciting milestone.

I've been following [Company]'s content — [write one specific observation here].

We work with funded teams scaling their content ops.

[VIDEO]

Open to a 20-min chat?

[Sender]`,
  },
  {
    id: '3',
    name: 'Letterstory Pitch',
    subject: 'Quick note re: [Company]',
    body: `Hi [FirstName],

I'm the founder of Letterstory — our platform helps teams produce editorial-grade longform content for their marketing site. We work with folks like PostHog, Runlayer, Archil, Credal, and others.

One of our strengths is enhancing existing content to perform better on SEO/GEO and convert more readers. I'd love to do that with [write one specific post or topic from their blog here].

[VIDEO]

Happy to do that, then jump on a call if you see the value. Let me know!

[Sender]`,
  },
]
