/**
 * Trellis Native Acceleration Engine C Header.
 * Provides SIMD-optimized float64 vector mathematics, blocked cache-oblivious
 * matrix routines, and hardware Castagnoli CRC32-C integrity verification.
 */

#ifndef TRELLIS_H
#define TRELLIS_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Calculates sum across a float64 contiguous vector.
 * Utilizes SIMD vector registers (AVX2/NEON) with unrolled scalar tails.
 */
double trellis_vector_sum_f64(const double* data, size_t length);

/**
 * Calculates arithmetic mean across a float64 contiguous vector.
 */
double trellis_vector_mean_f64(const double* data, size_t length);

/**
 * Finds minimum value across a float64 contiguous vector.
 */
double trellis_vector_min_f64(const double* data, size_t length);

/**
 * Finds maximum value across a float64 contiguous vector.
 */
double trellis_vector_max_f64(const double* data, size_t length);

/**
 * Computes dot product between two float64 vectors of equal length.
 */
double trellis_vector_dot_f64(const double* a, const double* b, size_t length);

/**
 * Computes sample (sample=1) or population (sample=0) variance.
 */
double trellis_vector_variance_f64(const double* data, size_t length, int sample);

/**
 * Performs cache-blocked matrix multiplication C = A x B.
 * Dimensions: A is (m x k), B is (k x n), C is (m x n).
 */
void trellis_matrix_multiply_f64(
    const double* a,
    const double* b,
    double* out,
    size_t m,
    size_t k,
    size_t n
);

/**
 * Performs cache-blocked matrix transposition dst = src^T.
 * Dimensions: src is (rows x cols), dst is (cols x rows).
 */
void trellis_matrix_transpose_f64(
    const double* src,
    double* dst,
    size_t rows,
    size_t cols
);

/**
 * Computes 32-bit Castagnoli CRC32-C checksum over byte buffer.
 * Utilizes hardware instruction where supported, falling back to Slice-by-8.
 */
uint32_t trellis_crc32c(const uint8_t* data, size_t length, uint32_t initial_crc);

#ifdef __cplusplus
}
#endif

#endif /* TRELLIS_H */
