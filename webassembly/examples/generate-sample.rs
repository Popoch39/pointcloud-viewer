//! Generates sample.las and sample.laz (a colored spiral) for manual testing,
//! plus sample-nocrs.las to exercise the unknown-EPSG fallback.
//! Usage: cargo run --example generate-sample [output-dir]

use las::point::{Classification, Format};
use las::{Builder, Color, Point, Transform, Vector, Vlr, Writer};

// Central Paris in Lambert-93 (EPSG:2154), so the cloud lands on rich IGN
// orthophoto imagery.
const ORIGIN_X: f64 = 651_500.0;
const ORIGIN_Y: f64 = 6_861_000.0;
const EPSG: u16 = 2154;

/// GeoTIFF GeoKeyDirectory VLR declaring ProjectedCSTypeGeoKey (3072) = epsg.
fn geokey_vlr(epsg: u16) -> Vlr {
    let words: [u16; 8] = [1, 1, 0, 1, 3072, 0, 1, epsg];
    Vlr {
        user_id: "LASF_Projection".to_string(),
        record_id: 34735,
        description: "GeoTIFF GeoKeyDirectoryTag".to_string(),
        data: words.iter().flat_map(|word| word.to_le_bytes()).collect(),
    }
}

fn main() {
    let out_dir = std::env::args().nth(1).unwrap_or_else(|| ".".to_string());
    let points: Vec<Point> = (0..100_000)
        .map(|i| {
            let t = i as f64 / 100.0;
            Point {
                x: ORIGIN_X + t.cos() * t * 0.05,
                y: ORIGIN_Y + t.sin() * t * 0.05,
                z: 50.0 + t * 0.02,
                intensity: (i % 65_536) as u16,
                classification: Classification::new((i % 6) as u8).unwrap(),
                color: Some(Color {
                    red: ((t.sin() * 0.5 + 0.5) * 65_535.0) as u16,
                    green: ((t.cos() * 0.5 + 0.5) * 65_535.0) as u16,
                    blue: ((i as f64 / 100_000.0) * 65_535.0) as u16,
                }),
                ..Default::default()
            }
        })
        .collect();

    let variants = [
        ("sample.las", false, true),
        ("sample.laz", true, true),
        ("sample-nocrs.las", false, false),
    ];
    for (name, compressed, with_crs) in variants {
        let mut builder = Builder::from((1, 2));
        builder.point_format = Format::new(2).unwrap();
        builder.point_format.is_compressed = compressed;
        if with_crs {
            builder.vlrs.push(geokey_vlr(EPSG));
        }
        // Georeferenced coordinates need a header offset to fit the i32 raw values
        builder.transforms = Vector {
            x: Transform { scale: 0.001, offset: ORIGIN_X },
            y: Transform { scale: 0.001, offset: ORIGIN_Y },
            z: Transform { scale: 0.001, offset: 0.0 },
        };
        let header = builder.into_header().unwrap();
        let path = format!("{out_dir}/{name}");
        let mut writer = Writer::from_path(&path, header).unwrap();
        writer.write_points(&points).unwrap();
        writer.close().unwrap();
        println!("wrote {path} ({} points)", points.len());
    }
}
