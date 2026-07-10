use std::io::Cursor;

use las::point::{Classification, Format};
use las::{Builder, Point, Vlr, Writer};
use pointcloud_baker::bake_to_pcbk;

fn write_las(format: Format, points: Vec<Point>) -> Vec<u8> {
    write_las_with_vlrs(format, points, Vec::new())
}

fn write_las_with_vlrs(format: Format, points: Vec<Point>, vlrs: Vec<Vlr>) -> Vec<u8> {
    let mut builder = Builder::from((1, 2));
    builder.point_format = format;
    builder.vlrs = vlrs;
    let header = builder.into_header().unwrap();
    let mut writer = Writer::new(Cursor::new(Vec::new()), header).unwrap();
    for point in points {
        writer.write_point(point).unwrap();
    }
    writer.close().unwrap();
    writer.into_inner().unwrap().into_inner()
}

fn u32_at(bytes: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
}

fn f64_at(bytes: &[u8], at: usize) -> f64 {
    f64::from_le_bytes(bytes[at..at + 8].try_into().unwrap())
}

fn f32_at(bytes: &[u8], at: usize) -> f32 {
    f32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
}

fn u16_at(bytes: &[u8], at: usize) -> u16 {
    u16::from_le_bytes(bytes[at..at + 2].try_into().unwrap())
}

fn sample_points() -> Vec<Point> {
    vec![
        Point {
            x: 100000.5,
            y: 200000.25,
            z: 10.0,
            intensity: 100,
            classification: Classification::new(2).unwrap(),
            ..Default::default()
        },
        Point {
            x: 100001.5,
            y: 200002.25,
            z: 50.0,
            intensity: 200,
            classification: Classification::new(3).unwrap(),
            ..Default::default()
        },
        Point {
            x: 100003.0,
            y: 200001.0,
            z: 30.0,
            intensity: 300,
            classification: Classification::new(5).unwrap(),
            ..Default::default()
        },
    ]
}

/// Builds a GeoTIFF GeoKeyDirectory (record_id 34735) payload from
/// `(key_id, tiff_tag_location, count, value_offset)` entries.
fn geokey_directory(entries: &[(u16, u16, u16, u16)]) -> Vec<u8> {
    let mut words: Vec<u16> = vec![1, 1, 0, entries.len() as u16];
    for &(key, location, count, value) in entries {
        words.extend_from_slice(&[key, location, count, value]);
    }
    words.iter().flat_map(|word| word.to_le_bytes()).collect()
}

fn projection_vlr(record_id: u16, data: Vec<u8>) -> Vlr {
    Vlr {
        user_id: "LASF_Projection".to_string(),
        record_id,
        description: String::new(),
        data,
    }
}

fn with_colors(colors: [(u16, u16, u16); 3]) -> Vec<Point> {
    sample_points()
        .into_iter()
        .zip(colors)
        .map(|(mut point, (red, green, blue))| {
            point.color = Some(las::Color { red, green, blue });
            point
        })
        .collect()
}

#[test]
fn bakes_las_without_color_into_recentered_pcbk() {
    let las_bytes = write_las(Format::new(0).unwrap(), sample_points());

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    // Header: magic, version, count, flags (intensity=2 | classification=4)
    assert_eq!(&bin[0..4], b"PCBK");
    assert_eq!(u32_at(&bin, 4), 2);
    assert_eq!(u32_at(&bin, 8), 3);
    assert_eq!(u32_at(&bin, 12), 2 | 4);

    // World offset = per-axis minimum of the cloud
    assert_eq!(f64_at(&bin, 16), 100000.5);
    assert_eq!(f64_at(&bin, 24), 200000.25);
    assert_eq!(f64_at(&bin, 32), 10.0);

    // Local bbox min/max
    let bbox: Vec<f32> = (0..6).map(|i| f32_at(&bin, 40 + i * 4)).collect();
    assert_eq!(bbox, vec![0.0, 0.0, 0.0, 2.5, 2.0, 40.0]);

    // EPSG (0 = unknown, no CRS VLR here) and reserved padding
    assert_eq!(u32_at(&bin, 64), 0);
    assert_eq!(u32_at(&bin, 68), 0);

    // Positions: f32 x3 per point, recentered on the offset
    let positions: Vec<f32> = (0..9).map(|i| f32_at(&bin, 72 + i * 4)).collect();
    assert_eq!(positions, vec![0.0, 0.0, 0.0, 1.0, 2.0, 40.0, 2.5, 0.75, 20.0]);

    // Intensity block right after positions (before RGB, to keep u16 2-aligned)
    let intensity_at = 72 + 9 * 4;
    assert_eq!(u16_at(&bin, intensity_at), 100);
    assert_eq!(u16_at(&bin, intensity_at + 2), 200);
    assert_eq!(u16_at(&bin, intensity_at + 4), 300);

    // No RGB block: classification follows directly
    let classif_at = intensity_at + 3 * 2;
    assert_eq!(&bin[classif_at..classif_at + 3], &[2, 3, 5]);

    assert_eq!(bin.len(), classif_at + 3);
}

#[test]
fn downscales_16bit_rgb_to_u8() {
    let points = with_colors([(65535, 32896, 256), (0, 255, 512), (1028, 2056, 3084)]);
    let las_bytes = write_las(Format::new(2).unwrap(), points);

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 12), 1 | 2 | 4);
    // RGB block sits after intensity so the u16 block stays 2-aligned
    let rgb_at = 72 + 9 * 4 + 3 * 2;
    assert_eq!(&bin[rgb_at..rgb_at + 9], &[255, 128, 1, 0, 0, 2, 4, 8, 12]);
    assert_eq!(u16_at(&bin, 72 + 9 * 4), 100);
    assert_eq!(bin.len(), 72 + 9 * 4 + 3 * 2 + 9 + 3);
}

#[test]
fn keeps_8bit_style_rgb_untouched() {
    let points = with_colors([(10, 20, 30), (255, 0, 5), (0, 0, 0)]);
    let las_bytes = write_las(Format::new(2).unwrap(), points);

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    let rgb_at = 72 + 9 * 4 + 3 * 2;
    assert_eq!(&bin[rgb_at..rgb_at + 9], &[10, 20, 30, 255, 0, 5, 0, 0, 0]);
}

#[test]
fn bakes_laz_identically_to_las() {
    let mut format = Format::new(2).unwrap();
    let colors = [(65535, 32896, 256), (0, 255, 512), (1028, 2056, 3084)];
    let from_las = bake_to_pcbk(write_las(format, with_colors(colors)), |_, _| {}).unwrap();

    format.is_compressed = true;
    let laz_bytes = write_las(format, with_colors(colors));
    let from_laz = bake_to_pcbk(laz_bytes, |_, _| {}).unwrap();

    assert_eq!(from_las, from_laz);
}

#[test]
fn reports_final_progress() {
    let las_bytes = write_las(Format::new(0).unwrap(), sample_points());

    let mut calls: Vec<(u64, u64)> = Vec::new();
    bake_to_pcbk(las_bytes, |done, total| calls.push((done, total))).unwrap();

    assert_eq!(calls.last(), Some(&(3, 3)));
    assert!(calls.iter().all(|&(_, total)| total == 3));
}

#[test]
fn bakes_empty_las() {
    let las_bytes = write_las(Format::new(0).unwrap(), Vec::new());

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 8), 0);
    assert_eq!(bin.len(), 72);
}

#[test]
fn extracts_epsg_from_geotiff_projected_cs_key() {
    let vlr = projection_vlr(34735, geokey_directory(&[(3072, 0, 1, 2154)]));
    let las_bytes = write_las_with_vlrs(Format::new(0).unwrap(), sample_points(), vec![vlr]);

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 64), 2154);
}

#[test]
fn falls_back_to_geographic_key_when_projected_is_user_defined() {
    let directory = geokey_directory(&[(3072, 0, 1, 32767), (2048, 0, 1, 4326)]);
    let vlr = projection_vlr(34735, directory);
    let las_bytes = write_las_with_vlrs(Format::new(0).unwrap(), sample_points(), vec![vlr]);

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 64), 4326);
}

#[test]
fn prefers_geotiff_key_over_wkt() {
    let geotiff = projection_vlr(34735, geokey_directory(&[(3072, 0, 1, 2154)]));
    let wkt = projection_vlr(2112, b"PROJCS[\"X\",AUTHORITY[\"EPSG\",\"32631\"]]".to_vec());
    let las_bytes = write_las_with_vlrs(Format::new(0).unwrap(), sample_points(), vec![geotiff, wkt]);

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 64), 2154);
}

#[test]
fn extracts_epsg_from_last_wkt1_authority() {
    // The outermost CRS authority comes last in WKT1; nested ones (datum,
    // geographic CRS) must not win.
    let wkt = b"PROJCS[\"RGF93 / Lambert-93\",GEOGCS[\"RGF93\",AUTHORITY[\"EPSG\",\"4171\"]],AUTHORITY[\"EPSG\",\"2154\"]]\0".to_vec();
    let las_bytes = write_las_with_vlrs(
        Format::new(0).unwrap(),
        sample_points(),
        vec![projection_vlr(2112, wkt)],
    );

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 64), 2154);
}

#[test]
fn extracts_epsg_from_wkt2_id() {
    let wkt = b"PROJCRS[\"WGS 84 / UTM zone 31N\",ID[\"EPSG\",32631]]".to_vec();
    let las_bytes = write_las_with_vlrs(
        Format::new(0).unwrap(),
        sample_points(),
        vec![projection_vlr(2112, wkt)],
    );

    let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

    assert_eq!(u32_at(&bin, 64), 32631);
}

#[test]
fn treats_user_defined_and_malformed_directories_as_unknown() {
    // Sentinel 32767 (user-defined) and a truncated directory must both bake
    // fine with epsg = 0.
    for data in [
        geokey_directory(&[(3072, 0, 1, 32767)]),
        vec![1, 0, 1, 0],
        Vec::new(),
    ] {
        let vlr = projection_vlr(34735, data);
        let las_bytes = write_las_with_vlrs(Format::new(0).unwrap(), sample_points(), vec![vlr]);

        let bin = bake_to_pcbk(las_bytes, |_, _| {}).unwrap();

        assert_eq!(u32_at(&bin, 64), 0);
    }
}
