/**
 * Cache-blocked matrix multiplication and transposition routines.
 */

#include "../include/trellis.h"
#include <string.h>

#define MATRIX_BLOCK_SIZE 32

void trellis_matrix_multiply_f64(
    const double* a,
    const double* b,
    double* out,
    size_t m,
    size_t k,
    size_t n
) {
  if (a == NULL || b == NULL || out == NULL || m == 0 || k == 0 || n == 0) {
    return;
  }

  // Zero-initialize output buffer
  memset(out, 0, m * n * sizeof(double));

  // Tiled 3-loop matrix multiplication with i-k-j ordering for cache locality
  for (size_t ii = 0; ii < m; ii += MATRIX_BLOCK_SIZE) {
    size_t i_max = (ii + MATRIX_BLOCK_SIZE < m) ? (ii + MATRIX_BLOCK_SIZE) : m;

    for (size_t kk = 0; kk < k; kk += MATRIX_BLOCK_SIZE) {
      size_t k_max = (kk + MATRIX_BLOCK_SIZE < k) ? (kk + MATRIX_BLOCK_SIZE) : k;

      for (size_t jj = 0; jj < n; jj += MATRIX_BLOCK_SIZE) {
        size_t j_max = (jj + MATRIX_BLOCK_SIZE < n) ? (jj + MATRIX_BLOCK_SIZE) : n;

        for (size_t i = ii; i < i_max; i++) {
          for (size_t p = kk; p < k_max; p++) {
            double a_ip = a[i * k + p];

            for (size_t j = jj; j < j_max; j++) {
              out[i * n + j] += a_ip * b[p * n + j];
            }
          }
        }
      }
    }
  }
}

void trellis_matrix_transpose_f64(
    const double* src,
    double* dst,
    size_t rows,
    size_t cols
) {
  if (src == NULL || dst == NULL || rows == 0 || cols == 0) {
    return;
  }

  for (size_t ii = 0; ii < rows; ii += MATRIX_BLOCK_SIZE) {
    size_t i_max = (ii + MATRIX_BLOCK_SIZE < rows) ? (ii + MATRIX_BLOCK_SIZE) : rows;

    for (size_t jj = 0; jj < cols; jj += MATRIX_BLOCK_SIZE) {
      size_t j_max = (jj + MATRIX_BLOCK_SIZE < cols) ? (jj + MATRIX_BLOCK_SIZE) : cols;

      for (size_t i = ii; i < i_max; i++) {
        for (size_t j = jj; j < j_max; j++) {
          dst[j * rows + i] = src[i * cols + j];
        }
      }
    }
  }
}
