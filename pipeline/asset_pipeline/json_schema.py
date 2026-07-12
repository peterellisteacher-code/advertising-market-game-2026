"""Project Draft 2020-12 vocabulary for catalogue semantic constraints.

Draft 2020-12 cannot express lexicographic array order, uniqueness by one
object property, or a product limit across two numeric properties.  The
catalogue schema declares those rules with small ``x-*`` keywords and every
project-side JSON Schema check uses this validator.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, validators
from jsonschema.exceptions import ValidationError


def _canonical_order(validator: Any, mode: object, instance: object, schema: object):
    if not isinstance(instance, list):
        return
    if mode is True:
        keys = instance
    elif isinstance(mode, str):
        keys = [item.get(mode) if isinstance(item, Mapping) else None for item in instance]
    else:
        return
    try:
        ordered = sorted(keys)
    except TypeError:
        return
    if keys != ordered:
        yield ValidationError("array values are not in canonical order")


def _unique_by(validator: Any, property_name: object, instance: object, schema: object):
    if not isinstance(instance, list) or not isinstance(property_name, str):
        return
    seen: set[object] = set()
    for item in instance:
        if not isinstance(item, Mapping) or property_name not in item:
            continue
        value = item[property_name]
        try:
            duplicate = value in seen
            seen.add(value)
        except TypeError:
            continue
        if duplicate:
            yield ValidationError(f"array values must be unique by {property_name}")
            return


def _max_product(validator: Any, rule: object, instance: object, schema: object):
    if not isinstance(instance, Mapping) or not isinstance(rule, Mapping):
        return
    properties = rule.get("properties")
    maximum = rule.get("maximum")
    if not isinstance(properties, list) or len(properties) != 2 or not isinstance(maximum, int):
        return
    left, right = (instance.get(name) for name in properties)
    if (
        isinstance(left, int)
        and not isinstance(left, bool)
        and isinstance(right, int)
        and not isinstance(right, bool)
        and left * right > maximum
    ):
        yield ValidationError(f"numeric property product exceeds {maximum}")


def _trimmed_text(validator: Any, enabled: object, instance: object, schema: object):
    if enabled is not True or not isinstance(instance, str):
        return
    if not instance or instance != instance.strip() or any(ord(character) < 32 for character in instance):
        yield ValidationError("text must be trimmed, non-empty, and free of control characters")


def _safe_attribution_url(validator: Any, enabled: object, instance: object, schema: object):
    if enabled is not True or not isinstance(instance, str) or instance == "local":
        return
    try:
        parsed = urlsplit(instance)
        parsed.port
        valid = (
            instance.startswith(("http://", "https://"))
            and "\\" not in instance
            and parsed.scheme in {"http", "https"}
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        valid = False
    if not valid:
        yield ValidationError("attribution sourceUrl must be local or a safe absolute HTTP(S) URL")


CatalogDraft202012Validator = validators.extend(
    Draft202012Validator,
    {
        "x-canonicalOrder": _canonical_order,
        "x-uniqueBy": _unique_by,
        "x-maxProduct": _max_product,
        "x-trimmedText": _trimmed_text,
        "x-safeAttributionUrl": _safe_attribution_url,
    },
)


def catalog_schema_validator(schema: Mapping[str, Any]):
    """Return the catalogue validator with the required project vocabulary."""

    return CatalogDraft202012Validator(schema)


__all__ = ["CatalogDraft202012Validator", "catalog_schema_validator"]
