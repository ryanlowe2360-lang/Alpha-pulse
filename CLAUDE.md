# Alpha Pulse — AI-Powered Alternative Data Signal Dashboard

## What This Is
A web dashboard that aggregates social sentiment (Reddit + X/Twitter), financial news, and options flow data, then uses Claude's API to generate daily trading signals for stocks and options.

## Tech Stack
- Frontend: React 18 + Tailwind CSS + Recharts
- Backend: Python 3.11+ with FastAPI
- AI: Claude API (Sonnet) for sentiment analysis and signal synthesis
- Database: SQLite for signal history
- Dependencies: tweepy, beautifulsoup4
- Deployment: Vercel (frontend) + Railway (backend)

## Data Sources
- Reddit (PRAW): r/wallstreetbets, r/options, r/stocks
- X/Twitter (via free API or Nitter scraping): $cashtag mentions, fintwit sentiment
- Finnhub: Financial news
- Yahoo Finance (yfinance): Price, volume, options chains

## Project Structure
/frontend — React dashboard app
/backend — Python FastAPI server
/scripts — Data collection scripts

## Code Style
- Frontend: Functional React components with hooks. Tailwind for styling. No CSS files.
- Backend: Type hints on all Python functions. Pydantic models for request/response.
- Always use async/await for API calls.

## Commands
- Frontend: cd frontend && npm run dev (port 3000)
- Backend: cd backend && uvicorn main:app --reload (port 8000)
- Tests: pytest in /backend

## Critical Rules
- NEVER hardcode API keys. Use .env files.
- All API responses must include proper error handling.
- Every new feature needs a loading state and error state in the UI.
- Use dark theme colors throughout (bg-gray-900, bg-gray-800, text-white).
