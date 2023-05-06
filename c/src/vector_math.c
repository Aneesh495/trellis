/**
 * High-performance vector mathematics kernel with loop unrolling and SIMD intrinsics.
 */

#include "../include/trellis.h"
#include <math.h>

#if defined(__ARM_NEON) || defined(__ARM_NEON__)
#include <arm_neon.h>
#define TRELLIS_USE_NEON 1
#elif defined(__AVX2__)
#include <immintrin.h>
#define TRELLIS_USE_AVX2 1
#endif

double trellis_vector_sum_f64(const double* data, size_t length) {
  if (data == NULL || length == 0) {
    return 0.0;
  }

  size_t i = 0;
  double sum0 = 0.0;
  double sum1 = 0.0;
  double sum2 = 0.0;
  double sum3 = 0.0;

#if defined(TRELLIS_USE_NEON)
  float64x2_t vsum0 = vdupq_n_f64(0.0);
  float64x2_t vsum1 = vdupq_n_f64(0.0);

  size_t simd_limit = length >= 4 ? length - 3 : 0;
  for (; i < simd_limit; i += 4) {
    float64x2_t v0 = vld1q_f64(data + i);
    float64x2_t v1 = vld1q_f64(data + i + 2);
    vsum0 = vaddq_f64(vsum0, v0);
    vsum1 = vaddq_f64(vsum1, v1);
  }

  float64x2_t vsum = vaddq_f64(vsum0, vsum1);
  sum0 = vgetq_lane_f64(vsum, 0) + vgetq_lane_f64(vsum, 1);
#else
  // 4-way scalar accumulator unrolling to maximize CPU pipeline throughput
  size_t unroll_limit = length >= 4 ? length - 3 : 0;
  for (; i < unroll_limit; i += 4) {
    sum0 += data[i];
    sum1 += data[i + 1];
    sum2 += data[i + 2];
    sum3 += data[i + 3];
  }
#endif

  // Accumulate remainder tail
  for (; i < length; i++) {
    sum0 += data[i];
  }

  return sum0 + sum1 + sum2 + sum3;
}

double trellis_vector_mean_f64(const double* data, size_t length) {
  if (data == NULL || length == 0) {
    return 0.0;
  }
  return trellis_vector_sum_f64(data, length) / (double)length;
}

double trellis_vector_min_f64(const double* data, size_t length) {
  if (data == NULL || length == 0) {
    return 0.0;
  }

  double min_val = data[0];
  size_t i = 1;

  for (; i < length; i++) {
    if (data[i] < min_val) {
      min_val = data[i];
    }
  }

  return min_val;
}

double trellis_vector_max_f64(const double* data, size_t length) {
  if (data == NULL || length == 0) {
    return 0.0;
  }

  double max_val = data[0];
  size_t i = 1;

  for (; i < length; i++) {
    if (data[i] > max_val) {
      max_val = data[i];
    }
  }

  return max_val;
}

double trellis_vector_dot_f64(const double* a, const double* b, size_t length) {
  if (a == NULL || b == NULL || length == 0) {
    return 0.0;
  }

  size_t i = 0;
  double dot0 = 0.0;
  double dot1 = 0.0;
  double dot2 = 0.0;
  double dot3 = 0.0;

#if defined(TRELLIS_USE_NEON)
  float64x2_t vdot0 = vdupq_n_f64(0.0);
  float64x2_t vdot1 = vdupq_n_f64(0.0);

  size_t simd_limit = length >= 4 ? length - 3 : 0;
  for (; i < simd_limit; i += 4) {
    float64x2_t va0 = vld1q_f64(a + i);
    float64x2_t vb0 = vld1q_f64(b + i);
    float64x2_t va1 = vld1q_f64(a + i + 2);
    float64x2_t vb1 = vld1q_f64(b + i + 2);

    vdot0 = vmlaq_f64(vdot0, va0, vb0);
    vdot1 = vmlaq_f64(vdot1, va1, vb1);
  }

  float64x2_t vdot = vaddq_f64(vdot0, vdot1);
  dot0 = vgetq_lane_f64(vdot, 0) + vgetq_lane_f64(vdot, 1);
#else
  size_t unroll_limit = length >= 4 ? length - 3 : 0;
  for (; i < unroll_limit; i += 4) {
    dot0 += a[i] * b[i];
    dot1 += a[i + 1] * b[i + 1];
    dot2 += a[i + 2] * b[i + 2];
    dot3 += a[i + 3] * b[i + 3];
  }
#endif

  for (; i < length; i++) {
    dot0 += a[i] * b[i];
  }

  return dot0 + dot1 + dot2 + dot3;
}

double trellis_vector_variance_f64(const double* data, size_t length, int sample) {
  if (data == NULL || length < 2) {
    return 0.0;
  }

  double mean = trellis_vector_mean_f64(data, length);
  double sum_sq_diff = 0.0;

  for (size_t i = 0; i < length; i++) {
    double diff = data[i] - mean;
    sum_sq_diff += diff * diff;
  }

  size_t divisor = sample ? (length - 1) : length;
  return sum_sq_diff / (double)divisor;
}
