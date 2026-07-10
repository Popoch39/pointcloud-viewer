//! EPSG extraction from LAS CRS VLRs.
//!
//! LAS stores its CRS in "LASF_Projection" VLRs, either as a GeoTIFF
//! GeoKeyDirectory (record 34735, the only form in LAS <= 1.3) or as WKT
//! (record 2112, mandatory in LAS 1.4). GeoTIFF is checked first: when a
//! 1.4 file carries both, key 3072 is unambiguous and cheaper to parse.
//! Extraction never fails a bake: anything malformed yields 0 (unknown).

const GEOTIFF_KEY_DIRECTORY: u16 = 34735;
const WKT_CRS: u16 = 2112;

const PROJECTED_CS_TYPE_GEO_KEY: u16 = 3072;
const GEOGRAPHIC_TYPE_GEO_KEY: u16 = 2048;

/// GeoKey values 0 and 32767 mean "undefined" and "user-defined".
fn is_real_epsg(value: u16) -> bool {
    value != 0 && value != 32767
}

/// Returns the EPSG code of the cloud's CRS, or 0 when unknown.
pub fn extract_epsg(header: &las::Header) -> u32 {
    let projection_vlrs: Vec<&las::Vlr> = header
        .all_vlrs()
        .filter(|vlr| {
            vlr.user_id
                .trim_end_matches('\0')
                .eq_ignore_ascii_case("LASF_Projection")
        })
        .collect();

    for vlr in &projection_vlrs {
        if vlr.record_id == GEOTIFF_KEY_DIRECTORY
            && let Some(epsg) = epsg_from_geokey_directory(&vlr.data)
        {
            return epsg;
        }
    }
    for vlr in &projection_vlrs {
        if vlr.record_id == WKT_CRS
            && let Some(epsg) = epsg_from_wkt(&vlr.data)
        {
            return epsg;
        }
    }
    0
}

/// Parses a GeoTIFF GeoKeyDirectory: a 4-u16 header (version, revision,
/// minor, number_of_keys) then per key (key_id, tiff_tag_location, count,
/// value_offset), all little-endian. A key whose tiff_tag_location is 0
/// stores its value directly in value_offset.
fn epsg_from_geokey_directory(data: &[u8]) -> Option<u32> {
    let word = |index: usize| -> Option<u16> {
        let at = index * 2;
        Some(u16::from_le_bytes(data.get(at..at + 2)?.try_into().ok()?))
    };
    let number_of_keys = word(3)? as usize;
    let mut fallback: Option<u32> = None;
    for key in 0..number_of_keys {
        let at = 4 + key * 4;
        let (key_id, location, value) = (word(at)?, word(at + 1)?, word(at + 3)?);
        if location != 0 || !is_real_epsg(value) {
            continue;
        }
        if key_id == PROJECTED_CS_TYPE_GEO_KEY {
            return Some(u32::from(value));
        }
        if key_id == GEOGRAPHIC_TYPE_GEO_KEY {
            fallback = Some(u32::from(value));
        }
    }
    fallback
}

/// Pulls the EPSG code out of a WKT string. The outermost CRS is the last
/// WKT1 `AUTHORITY["EPSG","xxxx"]` or WKT2 `ID["EPSG",xxxx]` in the text.
fn epsg_from_wkt(data: &[u8]) -> Option<u32> {
    let wkt = str::from_utf8(data).ok()?.trim_end_matches('\0');
    let digits_after = |marker: &str| -> Option<&str> {
        let at = wkt.rfind(marker)? + marker.len();
        let rest = &wkt[at..];
        let end = rest.find(|c: char| !c.is_ascii_digit())?;
        (end > 0).then(|| &rest[..end])
    };
    let code = digits_after("AUTHORITY[\"EPSG\",\"").or_else(|| digits_after("ID[\"EPSG\","))?;
    code.parse().ok().filter(|&epsg| epsg != 0)
}
