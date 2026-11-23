"""The phase-1 vocabulary: Ágora is a leisure discounts app.

Two things a student does — buy something, or go to something — and seven
categories between them. This list is the contract: the database stores these
keys, the API will not accept any other, and the apps mirror it. Adding an
eighth category means adding it here first.

Order matters: it is the order the chips appear in, buying first.
"""

LEISURE = [
    # key           group     en                es                  icon      pin colour
    ("restaurants", "buy",    "Restaurants",    "Restaurantes",     "amphora", "#8E3B22"),
    ("products",    "buy",    "Products",       "Productos",        "seal",    "#9C7246"),
    ("club",        "out",    "Clubbing",       "Discoteca",        "spark",   "#6B3A6E"),
    ("football",    "out",    "Football",       "Fútbol",           "ball",    "#2F6B46"),
    ("theatre",     "out",    "Theatre",        "Teatro",           "mask",    "#7A4E86"),
    ("cinema",      "out",    "Cinema",         "Cine",             "screen",  "#2C4C6B"),
    ("play",        "out",    "Play together",  "Jugar juntos",     "racket",  "#1F6B6B"),
]

KEYS = [k for k, *_ in LEISURE]
GROUP = {k: g for k, g, *_ in LEISURE}
LABEL_EN = {k: en for k, _g, en, *_ in LEISURE}
LABEL_ES = {k: es for k, _g, _en, es, *_ in LEISURE}


def valid(key):
    """A filter value the API will honour, or '' for everything."""
    return key if key in GROUP else ""


def as_json():
    """What the apps need to draw the chips and the map pins."""
    return [{"key": k, "group": g, "en": en, "es": es, "icon": ic, "colour": col}
            for k, g, en, es, ic, col in LEISURE]
