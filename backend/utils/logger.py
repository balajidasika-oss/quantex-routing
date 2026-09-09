import logging
import sys

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
    COLOR_ENABLED = True
except ImportError:
    COLOR_ENABLED = False


class ColoredFormatter(logging.Formatter):
    """Custom formatter with ANSI color coding."""

    COLORS = {
        logging.DEBUG: Fore.CYAN if COLOR_ENABLED else "",
        logging.INFO: Fore.GREEN if COLOR_ENABLED else "",
        logging.WARNING: Fore.YELLOW if COLOR_ENABLED else "",
        logging.ERROR: Fore.RED if COLOR_ENABLED else "",
        logging.CRITICAL: Fore.MAGENTA + Style.BRIGHT if COLOR_ENABLED else "",
    }
    RESET = Style.RESET_ALL if COLOR_ENABLED else ""

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, "")
        record.levelname = f"{color}{record.levelname:<8}{self.RESET}"
        record.msg = f"{color}{record.msg}{self.RESET}"
        return super().format(record)


def setup_logger(name: str = "quantum_route_ai", level: int = logging.INFO) -> logging.Logger:
    """Configures and returns a structured application logger."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(level)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = ColoredFormatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


logger = setup_logger()
