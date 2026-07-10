//! Generates sample.las and sample.laz (a colored spiral) for manual testing.
//! Usage: cargo run --example generate-sample [output-dir]

use las::point::{Classification, Format};
use las::{Builder, Color, Point, Transform, Vector, Writer};

fn main() {
    let out_dir = std::env::args().nth(1).unwrap_or_else(|| ".".to_string());
    let points: Vec<Point> = (0..100_000)
        .map(|i| {
            let t = i as f64 / 100.0;
            Point {
                x: 731_000.0 + t.cos() * t * 0.05,
                y: 4_712_000.0 + t.sin() * t * 0.05,
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

    for (name, compressed) in [("sample.las", false), ("sample.laz", true)] {
        let mut builder = Builder::from((1, 2));
        builder.point_format = Format::new(2).unwrap();
        builder.point_format.is_compressed = compressed;
        // Georeferenced coordinates need a header offset to fit the i32 raw values
        builder.transforms = Vector {
            x: Transform { scale: 0.001, offset: 731_000.0 },
            y: Transform { scale: 0.001, offset: 4_712_000.0 },
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
