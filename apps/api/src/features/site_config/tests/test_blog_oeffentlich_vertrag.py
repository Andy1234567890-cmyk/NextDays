"""Vertrag Service → Renderer fuer die oeffentliche Beitragsliste.

Live am 05.09.2026: `/blog` und `/blog/rss.xml` antworteten 500, weil der
Service `blog=` uebergab, das Antwortmodell das Feld nicht kannte und pydantic
es still verwarf. Der Renderer las dann `liste.blog.blog_name` auf undefined.
"""
import pytest
from pydantic import ValidationError

from src.features.site_config.schemas import (
    PublicBlogAngaben,
    PublicPostListResponse,
    PublicPostResponse,
)


def test_beitragsliste_traegt_blogangaben() -> None:
    liste = PublicPostListResponse(blog=PublicBlogAngaben(blog_name="Küstenpost"))
    assert liste.blog.blog_name == "Küstenpost"
    # Ohne Angabe: leere, aber VORHANDENE Blogangaben — der Renderer greift
    # nie ins Leere.
    assert PublicPostListResponse().blog.blog_name is None


def test_unbekanntes_feld_wirft_statt_zu_verschwinden() -> None:
    with pytest.raises(ValidationError):
        PublicPostListResponse(unbekannt=1)  # type: ignore[call-arg]
    assert PublicPostResponse.model_config.get("extra") == "forbid"
