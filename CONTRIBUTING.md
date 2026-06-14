# Contributing

Thanks for your interest in OSPI. This project is open-source and contributions are welcome.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/ospi.git
   cd ospi
   ```
3. **Set up the backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate    # Windows
   source .venv/bin/activate # macOS/Linux
   pip install -r requirements.txt
   cp .env.example .env      # fill in DATABASE_URL and API keys
   ```
4. **Set up the frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local  # fill in NEXT_PUBLIC_BACKEND_URL
   ```
5. **Run ETL + training** to populate the database:
   ```bash
   cd backend
   python -m etl.jobs
   ```
6. **Start the dev servers:**
   ```bash
   # Terminal 1 — backend
   cd backend
   uvicorn main:app --reload

   # Terminal 2 — frontend
   cd frontend
   npm run dev
   ```

## Development Guidelines

- **Code style:** Follow the existing patterns in the codebase. No comments unless the logic is non-obvious.
- **TypeScript:** Use strict types. Avoid `any`.
- **Python:** Type hints required for function signatures.
- **Backend changes:** Run `python -m py_compile` on modified files to verify syntax.
- **Frontend changes:** Run `npm run build` to verify TypeScript and compilation.
- **Tests:** Run `pytest` (backend) or `npm test` (frontend) if test suites exist for the area you're modifying.
- **Branch:** Open PRs against the `develop` branch. `main` is for production-ready code only.

## Pull Request Process

1. Keep PRs focused — one feature or fix per PR
2. Write a clear, descriptive title and summary
3. Ensure the build passes (TypeScript + Python syntax checks)
4. Update `CHANGELOG.md` if the change is user-facing
5. PRs will be reviewed and merged or given feedback

## Reporting Issues

Open a [GitHub issue](https://github.com/jpaic/ospi/issues) with:
- A clear description of the problem
- Steps to reproduce
- Environment details (OS, Python version, Node version)

