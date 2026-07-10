use std::io::Cursor;

use las::Reader;

mod crs;

/// Progress callback granularity, in points.
const PROGRESS_CHUNK: u64 = 500_000;

const FLAG_RGB: u32 = 1;
const FLAG_INTENSITY: u32 = 1 << 1;
const FLAG_CLASSIFICATION: u32 = 1 << 2;

#[derive(Debug)]
pub enum BakeError {
    Las(las::Error),
    TooManyPoints(u64),
}

impl std::fmt::Display for BakeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BakeError::Las(err) => write!(f, "invalid LAS/LAZ file: {err}"),
            BakeError::TooManyPoints(count) => {
                write!(f, "point cloud has {count} points, more than the PCBK maximum")
            }
        }
    }
}

impl std::error::Error for BakeError {}

impl From<las::Error> for BakeError {
    fn from(err: las::Error) -> Self {
        BakeError::Las(err)
    }
}

/// Bakes a LAS/LAZ file into the PCBK binary format.
///
/// PCBK layout (little-endian): 72-byte header (magic "PCBK", version u32,
/// count u32, flags u32, world offset f64x3, local bbox f32x6, epsg u32 with
/// 0 = unknown, reserved u32) followed by planar blocks: positions f32x3,
/// intensity u16, rgb u8x3, classification u8. Intensity comes before rgb so
/// every block offset stays aligned for zero-copy TypedArray views. Positions
/// are recentered on the per-axis minimum (the world offset) so they stay
/// precise as f32.
pub fn bake_to_pcbk(
    las_bytes: Vec<u8>,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<Vec<u8>, BakeError> {
    let mut reader = Reader::new(Cursor::new(las_bytes))?;
    let total = reader.header().number_of_points();
    let count = u32::try_from(total).map_err(|_| BakeError::TooManyPoints(total))?;
    let has_color = reader.header().point_format().has_color;
    let offset = reader.header().bounds().min;
    let epsg = crs::extract_epsg(reader.header());

    let mut positions: Vec<f32> = Vec::with_capacity(count as usize * 3);
    let mut rgb16: Vec<u16> = Vec::with_capacity(if has_color { count as usize * 3 } else { 0 });
    let mut intensities: Vec<u16> = Vec::with_capacity(count as usize);
    let mut classifications: Vec<u8> = Vec::with_capacity(count as usize);
    let mut bbox_min = [0.0f32; 3];
    let mut bbox_max = [0.0f32; 3];

    let mut done: u64 = 0;
    for point in reader.points() {
        let point = point?;
        let local = [
            (point.x - offset.x) as f32,
            (point.y - offset.y) as f32,
            (point.z - offset.z) as f32,
        ];
        if done == 0 {
            bbox_min = local;
            bbox_max = local;
        } else {
            for axis in 0..3 {
                bbox_min[axis] = bbox_min[axis].min(local[axis]);
                bbox_max[axis] = bbox_max[axis].max(local[axis]);
            }
        }
        positions.extend_from_slice(&local);
        if has_color {
            let [red, green, blue] = point
                .color
                .map_or([0, 0, 0], |color| [color.red, color.green, color.blue]);
            rgb16.extend_from_slice(&[red, green, blue]);
        }
        intensities.push(point.intensity);
        classifications.push(u8::from(point.classification));
        done += 1;
        if done.is_multiple_of(PROGRESS_CHUNK) {
            on_progress(done, total);
        }
    }
    on_progress(done, total);

    let flags = if has_color { FLAG_RGB } else { 0 } | FLAG_INTENSITY | FLAG_CLASSIFICATION;
    let size = 72 + positions.len() * 4 + rgb16.len() + intensities.len() * 2 + classifications.len();
    let mut bin: Vec<u8> = Vec::with_capacity(size);
    bin.extend_from_slice(b"PCBK");
    bin.extend_from_slice(&2u32.to_le_bytes());
    bin.extend_from_slice(&count.to_le_bytes());
    bin.extend_from_slice(&flags.to_le_bytes());
    for value in [offset.x, offset.y, offset.z] {
        bin.extend_from_slice(&value.to_le_bytes());
    }
    for value in bbox_min.iter().chain(bbox_max.iter()) {
        bin.extend_from_slice(&value.to_le_bytes());
    }
    bin.extend_from_slice(&epsg.to_le_bytes());
    // Reserved padding: keeps the header a multiple of 8 for future f64 fields.
    bin.extend_from_slice(&0u32.to_le_bytes());
    for value in &positions {
        bin.extend_from_slice(&value.to_le_bytes());
    }
    for value in &intensities {
        bin.extend_from_slice(&value.to_le_bytes());
    }
    // LAS colors are 16-bit per channel, but files often store 8-bit values;
    // only downscale when the data actually uses the 16-bit range.
    if !rgb16.is_empty() {
        if rgb16.iter().all(|&value| value <= 255) {
            bin.extend(rgb16.iter().map(|&value| value as u8));
        } else {
            bin.extend(rgb16.iter().map(|&value| (value >> 8) as u8));
        }
    }
    bin.extend_from_slice(&classifications);
    Ok(bin)
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use wasm_bindgen::prelude::*;

    /// WASM entry point: bakes LAS/LAZ bytes into a PCBK buffer, reporting
    /// progress through `on_progress(done, total)`.
    #[wasm_bindgen]
    pub fn bake(las_bytes: Vec<u8>, on_progress: &js_sys::Function) -> Result<Vec<u8>, JsError> {
        crate::bake_to_pcbk(las_bytes, |done, total| {
            let _ = on_progress.call2(
                &JsValue::NULL,
                &JsValue::from_f64(done as f64),
                &JsValue::from_f64(total as f64),
            );
        })
        .map_err(|err| JsError::new(&err.to_string()))
    }
}
