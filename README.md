# ColdlyBound

AI-powered cold email generator that creates hyper-personalized emails under 100 words using 29 proven frameworks from top sales experts.

## Features

- 🎯 **29 Email Styles** - Frameworks from Jordan Crawford, Josh Braun, Alex Berman, and more
- ✨ **AI-Powered** - Uses Claude to generate personalized emails
- 📄 **File Upload** - Attach PDFs, DOCs, or other documents with target info
- 🔍 **Website Analysis** - Automatically scrapes target and sender websites
- 📝 **5 Variations** - Generates 5 different email angles per request
- ⚡ **Under 100 Words** - All emails are concise and action-oriented

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude
- **Language**: TypeScript

## Deployment

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## License

MIT
