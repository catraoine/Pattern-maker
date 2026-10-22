// The Privacy Policy and Terms of Use shown in the app. Drafts for a lawyer to review; the source documents are
// Cat's "Maison Tracé Privacy Policy (draft)" and "Maison Tracé Terms of Use (draft)". Keep the two in step.

/** The owner's details, shown in the privacy policy and terms. Keep in step with the Claude Docs drafts. */
export const OWNER = {
  name: 'Catraoine Mary Buckley',
  address: '505-428 West 8th Avenue, Vancouver, British Columbia V5Y 1N9, Canada',
  email: 'hello@maisontrace.co',
  law: 'British Columbia and the federal laws of Canada that apply there',
  effective: '21 October 2026',
  minimumAge: '16',
  liabilityCap: 'CA$50',
  courts: 'British Columbia, sitting in Vancouver',
};

/** A paragraph (a bold lead-in before any `|`), a bullet list, or a table whose first row is the header. */
export type Block = string | string[] | { table: string[][] };
export interface Section {
  heading: string;
  body: Block[];
}
export interface LegalDoc {
  title: string;
  intro: string;
  sections: Section[];
}

const contact = `${OWNER.name}, ${OWNER.address}. Email ${OWNER.email}.`;

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'Your measurements, the people you measure for and your saved patterns stay on your own device. We receive something from you only when you use photo-to-pattern (we don’t keep that photo), choose to send us fit notes, or sign up as a fit tester, for news, or to hear when something new opens. The app also sends us a short report if it crashes, and anonymous counts of visits, with nothing that identifies you.',
  sections: [
    {
      heading: 'Who we are',
      body: [
        `Maison Tracé is a sewing pattern app run by ${OWNER.name}, ${OWNER.address} (“we”, “us”). This policy explains what happens to your information when you use the Maison Tracé website and app.`,
        `If you have a question about this policy, email ${OWNER.email}.`,
      ],
    },
    {
      heading: 'What information is involved',
      body: [
        {
          table: [
            ['What', 'Where it’s kept', 'Do we receive it?'],
            ['Your name and the names of people you measure for', 'Your device', 'No'],
            ['Body measurements and units', 'Your device', 'No, unless you send fit notes'],
            ['Saved patterns and style choices', 'Your device', 'No'],
            ['Backup files you create', 'Wherever you save them', 'No'],
            ['Measure-me links between a dressmaker and a client (names, the garment and, in the reply, the measurements)', 'Inside the link, in the messages you send it in', 'No'],
            ['PDFs, tech packs and DXF files you export or share', 'Your device, or the app you share them to', 'No'],
            [
              'Fit notes you choose to send (pattern style, fit answers, your notes and the measurements the pattern was drafted from, with no name)',
              'Our server (Netlify)',
              'Only if you tick “Send these notes to Maison Tracé”',
            ],
            ['Photos you choose for photo-to-pattern', 'Sent for reading, then discarded', 'Yes, briefly'],
            ['Your IP address and basic request details', 'Our hosting provider’s logs', 'Yes, as part of serving the site'],
            [
              'Crash reports (the error, the screen you were on, the app version, your browser’s name and version, and the time; never measurements, names or photos)',
              'Our server (Netlify)',
              'Yes, if something goes wrong',
            ],
            [
              'Anonymous daily counts (visits, and how many visits reached measuring, styling, printing or photo-to-pattern, for each garment)',
              'Our server, as daily totals only',
              'Yes, added to the day’s totals',
            ],
            ['Your name, email, what you’d like to sew and a rough size range, if you sign up as a fit tester', 'Our server (Netlify)', 'Only if you sign up'],
            ['Your email, and the link you arrived by (such as an Instagram link), if you join the waitlist or sign up for news', 'Our server (Netlify) and our newsletter service (Kit)', 'Only if you sign up'],
            ['Your email, what you asked to hear about, and the pattern on screen or the city you picked, if you ask to hear when something opens (such as printing by post, a founding place, Atelier Nights tickets or early access for brands)', 'Our server (Netlify)', 'Only if you sign up'],
            ['A scrambled code made from your IP address', 'Our photo, fit-note and sign-up counters, for one day', 'Yes'],
          ],
        },
        'Your device.|The app saves your details in your browser’s storage so they’re there next time. They never leave your device unless you export, share or back them up yourself. Clearing your browser data, or uninstalling the app, deletes them.',
        'Measurements are personal.|Body measurements can be sensitive, which is one reason we keep them on your device. If you enter measurements for someone else, please make sure they’re happy for you to do so.',
        'Measure-me links.|A dressmaker can send a client a link to measure themselves, and the client sends the numbers back in a reply link. Everything travels inside the link, after the “#”, a part of a web address that browsers never send to a server, so we don’t receive or store it. The link is only as private as the message it’s sent in, and anyone who has it can read it, so send it only to the person it’s for.',
        'Fit notes.|When you note how a pattern fitted, you can choose to send those notes to us. We receive the pattern’s style, your answers, any notes you write and the measurements it was drafted from. We don’t receive your name or the name of the person it was made for, so please leave names out of your notes. We use fit notes only to improve how our patterns fit. We count how many you send each day under the same scrambled code as photo readings, so the service can’t be flooded, and we don’t store your IP address with the notes.',
        'Crash reports.|If the app hits an error, it sends us a short report so we can fix it: the error message and where in the app’s code it happened, the screen you were on, the app version, your browser’s name and version (such as “Safari 17 on iOS”), and the time. Before it’s stored, we remove numbers from the error message, and email addresses, file data and web address details from the whole report. It never includes your measurements, names, patterns or photos, and we don’t store your IP address with it. The same error is reported once, and no more than five a visit.',
        'Visit counts.|To see whether the app is working for people, we count visits and how many visits reached each step (measuring, choosing a style, printing or saving the PDF, and using photo-to-pattern), for each garment. Each count is added straight into a total for the day. There’s no cookie, no ID and no IP address stored, so the totals can’t be traced back to you or linked between visits. The counts are sent once, when you leave or switch away from the app. If your browser sends a “Do Not Track” or “Global Privacy Control” signal, we don’t count your visit at all.',
        'Fit testers and news.|If you sign up as a fit tester, we keep your name, email, what you’d like to sew and the size range you give (if any), and use them only to invite you to test new patterns. If you join the waitlist or sign up for news, we keep your email and the link you arrived by, and use them only to send Maison Tracé news and tell you when it opens. Our newsletter service, Kit, holds that list and sends those emails. If you ask to hear when something opens, we keep your email, what you asked about (such as whether you’d like deadstock cloth cut for you) and the pattern you were looking at (or, for Atelier Nights, the city you picked), and use them only to tell you when it opens. If cutting opens, your pattern file and posting address will go only to the cutting studio you choose, and we’ll ask you before anything is sent. If you ask about Tracé Engine for brands, we use your email only to get in touch about early access. We count sign-ups under the same scrambled code as photo readings, so the form can’t be flooded.',
        'What we don’t do.|We don’t use cookies, advertising, tracking or outside analytics tools, and we don’t sell or share your information for marketing. Crash reports, counts and sign-ups go to our own server, and waitlist and news sign-ups also go to our newsletter service. The app’s typefaces are built in, so your browser doesn’t contact a font service.',
      ],
    },
    {
      heading: 'Photo-to-pattern and the companies we work with',
      body: [
        'How a photo is read.|When you choose a photo, the app shrinks it on your device and sends it to our server. Our server passes it to Claude, an AI model made by Anthropic, which describes the skirt’s style (fit, shape, length, fullness). We send back the style and the photo is discarded. We don’t store your photo, and we never send your measurements or name with it.',
        'Please only use photos you have the right to use. If a person appears in the photo, make sure they’re happy for it to be used this way. A garment laid flat works too.',
        'Daily photo limits.|Each visitor gets a set number of photo readings a day. To count them we turn your IP address into a scrambled code (a one-way hash) and keep a tally for that day. We don’t store the address itself.',
        {
          table: [
            ['Company', 'What it does', 'What it sees'],
            ['Anthropic', 'Reads the style from your photo', 'The photo'],
            [
              'Netlify',
              'Hosts the site and runs our server code, including the daily counters, and stores fit notes, crash reports, daily visit totals and sign-ups',
              'Your IP address, request details, the photo in transit, fit notes and sign-ups you send, and crash reports',
            ],
            ['Kit', 'Keeps the waitlist and news list and sends those emails', 'Your email, the link you arrived by, and whether you open the emails'],
          ],
        },
        'Anthropic handles photos under its commercial terms for businesses using its API, which say it doesn’t train its models on that data. These companies are based in the United States, so your photo and request details may be processed there.',
        'We may also share information if the law requires it, or with a buyer if the business is ever sold, under this same policy.',
      ],
    },
    {
      heading: 'How long we keep things, and your choices',
      body: [
        [
          'On your device: until you delete it. You can remove people and patterns in Your account, or clear everything by clearing your browser data for this site.',
          'Photos: not kept by us once the style has been read.',
          'Fit notes you send: kept while we use them to improve our patterns. Because they carry no name, we can’t match them to you later unless you tell us roughly when you sent one and what it said.',
          'Daily counters: one tally per day, keyed by the scrambled code.',
          'Crash reports: kept while we work on the problems they show, then deleted.',
          'Daily visit totals: kept as totals. They hold nothing about any one person.',
          'Fit tester, news and “tell me when it opens” sign-ups: until you ask us to remove you, or we stop fit testing, sending news, or plan not to open what you asked about. Every news email will say how to stop them.',
          'Hosting logs: kept by Netlify for its standard period.',
        ],
        `Because almost everything stays on your device, we usually hold nothing we can look up about you, unless you signed up as a fit tester or for news. You can still contact us at ${OWNER.email} to ask what we hold, to correct it or to delete it. Depending on where you live (for example the UK, the EU, Canada or California), you may have further rights, including the right to complain to your local data protection authority.`,
      ],
    },
    {
      heading: 'Children, changes and contact',
      body: [
        `Children.|Maison Tracé is made for adults. Its measurement guide covers adult sizes only, and it isn’t directed at children under ${OWNER.minimumAge}. A parent or guardian may enter a child’s measurements on their own device.`,
        'Coming later.|When we add sign-in, saving to the cloud or paid plans, we’ll collect new information (such as an account email address, and payment details through a payment provider). We’ll update this policy before that happens and tell you in the app.',
        'Changes.|If we change this policy, we’ll update the date below and, for important changes, let you know in the app.',
        `Contact.|${contact}`,
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of Use',
  intro: 'These terms set out how you can use Maison Tracé and what we can and can’t promise. Please read them alongside our Privacy Policy.',
  sections: [
    {
      heading: 'Agreeing to these terms',
      body: [
        `These terms are an agreement between you and ${OWNER.name} (“we”, “us”), which runs Maison Tracé. By using the Maison Tracé website or app, you agree to them. If you don’t agree, please don’t use it.`,
        'Who can use it.|You must be an adult (18 or older, or the age of majority where you live) or have a parent or guardian’s permission.',
        'Using it as a guest.|You can measure, draft, preview and export patterns without an account. Your details are saved on your device only, as our Privacy Policy explains. You’re responsible for keeping your own backups. If you clear your browser or lose your device, we can’t recover your measurements or patterns.',
        'Accounts later.|When sign-in arrives, you’ll be responsible for keeping your login safe and for what happens under your account. We’ll update these terms before then.',
      ],
    },
    {
      heading: 'Free and paid plans',
      body: [
        'Maison Tracé is free to use today. Some features have fair-use limits, such as a set number of photo readings per person per day, and photo reading may pause when the whole service reaches its daily limit.',
        'We plan to offer a paid plan later with extras such as more garments, more saved people and more export formats. Before you’re ever charged, we’ll show you the price, what’s included, how billing and renewal work, and how to cancel, and you’ll need to agree to it. Paid plans will have their own billing terms.',
        'We may change or remove free features, but we’ll try to give notice of significant changes.',
      ],
    },
    {
      heading: 'Patterns, fit and sewing',
      body: [
        'Fit depends on your measurements.|Patterns are drafted from the measurements you enter. Small measuring errors can change the fit, so we always recommend making a test garment (a toile or muslin) in inexpensive fabric before cutting good fabric.',
        'Print and check scale.|Print at 100% (actual size) and measure the 10 cm test square before cutting. If you use a projector, calibrate it to the test square first.',
        'Photo readings are suggestions.|Photo-to-pattern uses AI to suggest the closest style. It can be wrong, especially with length, so check the style choices before you draft. A photo sets the style, never the size.',
        'The pattern check.|The app runs automatic checks on each pattern (seams matching, curves blending, darts trued). These help catch drafting errors but don’t guarantee a perfect result.',
        'Sewing safely.|Sewing involves sharp tools, irons and machines. Follow your equipment’s safety instructions. Our sewing steps are general guidance, not professional instruction.',
        'Maker pack for dressmakers and factories.|The tech pack and DXF files are provided to help a professional make your garment. Whoever makes it should review the pattern, measurements and construction notes, and make and fit a sample before cutting production fabric. We aren’t a party to any agreement between you and a dressmaker or factory, and we aren’t responsible for their work, pricing, materials or delivery. DXF files may open differently in different CAD programs, so check pieces against the PDF and the measurement table.',
        'Deadstock cloth and cutting (not open yet).|Deadstock lengths are limited and cut to order, so cut cloth can’t be returned, and colours can look different on screen. If you ask a cutting studio to cut your pieces, check your pattern and measurements first: the studio cuts exactly what the pattern shows. Signing up to hear when these open doesn’t reserve cloth or commit you to buy.',
      ],
    },
    {
      heading: 'Your content, our content and fair use',
      body: [
        'What’s yours.|Your measurements, photos and pattern names belong to you. When you send a photo for reading, you give us permission to process it only to read its style. You confirm you have the right to use that photo.',
        `What’s ours.|The app, its design, drafting methods, software, sewing steps and brand belong to ${OWNER.name}.`,
        'Using your patterns.|Each pattern you make is drafted for you. You may print it, sew from it, share it with a dressmaker or factory to make garments for you, and sell garments you make from it. You may not resell, share publicly or distribute the pattern files themselves, or present them as your own pattern product.',
        'Please don’t:',
        [
          'copy, reverse-engineer or resell the app or its drafting engine',
          'try to get around photo limits or overload the service',
          'upload photos that are unlawful, or that show someone without their permission',
          'use the app to break the law or anyone else’s rights, including copying another designer’s protected design for sale',
        ],
        `If you believe content in Maison Tracé infringes your rights, contact ${OWNER.email}.`,
      ],
    },
    {
      heading: 'Our promises, their limits, and the legal bits',
      body: [
        'No guarantee of fit or availability.|We work hard to make accurate patterns, but Maison Tracé is provided “as is”. We don’t promise that every pattern will fit perfectly, that the app will always be available, or that it will be free of errors.',
        `Limit of our responsibility.|As far as the law allows, we aren’t responsible for indirect losses, or for the cost of fabric, notions, sewing time or production runs, including work done by a dressmaker or factory. If we are found responsible, our total liability is limited to what you paid us in the 12 months before the claim, or ${OWNER.liabilityCap} if you paid nothing. Nothing in these terms limits rights you have by law as a consumer that can’t be excluded.`,
        'Stopping use.|You can stop using Maison Tracé at any time and delete your data by clearing it from your device. We may suspend access to features such as photo reading if these terms are broken.',
        'Changes to these terms.|We may update these terms. We’ll change the date below and tell you in the app about important changes. Continuing to use the app after that means you accept the new terms.',
        `Governing law.|These terms are governed by the laws of ${OWNER.law}, and disputes go to the courts of ${OWNER.courts}, unless the law where you live gives you the right to bring a claim there.`,
        `Contact.|${contact}`,
      ],
    },
  ],
};
