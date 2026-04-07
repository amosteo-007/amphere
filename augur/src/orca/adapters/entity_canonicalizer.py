"""EntityCanonicalizer — resolves free-text target strings to canonical entity IDs."""

from .base import EntityMatch


class EntityCanonicalizer:
    """
    Boundary-layer adapter for entity identity resolution.

    Resolves free-text target strings (e.g. 'Iran', 'Tehran', 'IRAN')
    to canonical entity_master IDs via FalkorDBLite lookup.

    Resolution strategy (in order):
      1. Exact match on entity_id
      2. Case-insensitive exact match on name
      3. Case-insensitive match on aliases list
      4. Fuzzy contains-match as fallback
    """

    def __init__(self, graph_client):
        self.graph = graph_client

    def resolve(self, text: str) -> EntityMatch | None:
        """
        Resolve a free-text string to a canonical entity.

        Returns EntityMatch with entity_id, name, entity_type, confidence,
        or None if no match found.
        """
        if not text:
            return None
        text = text.strip()

        # 1. Exact entity_id match
        match = self._lookup("entity_id", text)
        if match:
            return EntityMatch(entity_id=match["entity_id"], name=match["name"],
                               entity_type=match.get("entity_type", "UNKNOWN"),
                               confidence=0.95)

        # 2. Case-insensitive name match
        match = self._lookup("name", text.lower())
        if match:
            return EntityMatch(entity_id=match["entity_id"], name=match["name"],
                               entity_type=match.get("entity_type", "UNKNOWN"),
                               confidence=0.90)

        # 3. Alias match (iterate nodes)
        alias_match = self._alias_match(text)
        if alias_match:
            return alias_match

        # 4. Fuzzy/contains fallback
        fuzzy_match = self._fuzzy_match(text)
        return fuzzy_match

    def resolve_batch(self, texts: list[str]) -> list[EntityMatch | None]:
        """Resolve multiple free-text strings in batch."""
        return [self.resolve(t) for t in texts]

    # -------------------------------------------------------------------------
    # Internal lookup helpers — all graph I/O contained here
    # -------------------------------------------------------------------------

    def _lookup(self, property_name: str, value: str) -> dict | None:
        """Query FalkorDBLite for a node with matching property value."""
        try:
            if self.graph is None:
                return None
            query = f"MATCH (e:entity_master {{{property_name}: '{value}'}}) RETURN e LIMIT 1"
            results = self.graph.query(query)
            if results and len(results) > 0:
                record = results[0]
                if isinstance(record, dict) and "e" in record:
                    return record["e"]
                return record if isinstance(record, dict) else None
        except Exception as e:
            print(f"[EntityCanonicalizer] lookup error ({property_name}={value}): {e}")
        return None

    def _alias_match(self, text: str) -> EntityMatch | None:
        """
        Scan all entity_master nodes for alias match.
        Uses a single query that returns all entities, then filters in Python
        to avoid complex Cypher alias list matching across implementations.
        """
        try:
            if self.graph is None:
                return None
            results = self.graph.query("MATCH (e:entity_master) RETURN e")
            text_lower = text.lower()
            for record in results:
                entity = record.get("e", record) if isinstance(record, dict) else record
                if not isinstance(entity, dict):
                    continue
                aliases = entity.get("aliases") or []
                for alias in aliases:
                    if alias.lower() == text_lower:
                        return EntityMatch(
                            entity_id=entity["entity_id"],
                            name=entity.get("name", ""),
                            entity_type=entity.get("entity_type", "UNKNOWN"),
                            confidence=0.85,
                        )
        except Exception as e:
            print(f"[EntityCanonicalizer] alias match error: {e}")
        return None

    def _fuzzy_match(self, text: str) -> EntityMatch | None:
        """
        Fallback: case-insensitive contains on name.
        Returns the first partial match found.
        """
        try:
            if self.graph is None:
                return None
            results = self.graph.query("MATCH (e:entity_master) RETURN e")
            text_lower = text.lower()
            for record in results:
                entity = record.get("e", record) if isinstance(record, dict) else record
                if not isinstance(entity, dict):
                    continue
                name = entity.get("name", "")
                if text_lower in name.lower():
                    return EntityMatch(
                        entity_id=entity["entity_id"],
                        name=name,
                        entity_type=entity.get("entity_type", "UNKNOWN"),
                        confidence=0.70,
                    )
        except Exception as e:
            print(f"[EntityCanonicalizer] fuzzy match error: {e}")
        return None
