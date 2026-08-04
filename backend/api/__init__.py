"""Lightweight route registry.

Routes are (method, compiled_regex, handler, needs_auth, min_level).
Handlers receive a `ctx` dict: {user, params, query, body, ip}.
Return a dict/list (serialised to JSON) or a tuple (status, payload).
"""
import re

ROUTES = []


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


def route(method, pattern, needs_auth=True, min_level=0):
    regex = re.compile("^" + pattern + "$")

    def wrap(fn):
        ROUTES.append((method.upper(), regex, fn, needs_auth, min_level))
        return fn
    return wrap


def match(method, path):
    for m, regex, fn, needs_auth, min_level in ROUTES:
        if m != method:
            continue
        mo = regex.match(path)
        if mo:
            return fn, mo.groupdict(), needs_auth, min_level
    return None, None, None, None


# Import handlers so their @route decorators register.
from . import routes  # noqa: E402,F401
