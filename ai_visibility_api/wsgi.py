import os

from dotenv import load_dotenv

# override=True: .env always wins over any variable already set in the shell
# session. Without this, a stray `$env:SOME_VAR = "..."` typed earlier in the
# same terminal (common while debugging) silently overrides .env forever for
# that terminal's lifetime, since load_dotenv() does NOT overwrite existing
# environment variables by default.
load_dotenv(override=True)

from app import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
