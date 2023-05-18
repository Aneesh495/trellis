/**
 * Comprehensive C native test harness validating vector math, matrix ops, and CRC32-C.
 */

#include "../include/trellis.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <assert.h>
#include <string.h>

#define ASSERT_CLOSE(actual, expected, eps) \
  do { \
    double diff = fabs((actual) - (expected)); \
    if (diff > (eps)) { \
      fprintf(stderr, "FAILED: %s:%d: Expected %f but got %f (diff: %e)\n", \
              __FILE__, __LINE__, (double)(expected), (double)(actual), diff); \
      exit(1); \
    } \
  } while (0)

#define ASSERT_EQ(actual, expected) \
  do { \
    if ((actual) != (expected)) { \
      fprintf(stderr, "FAILED: %s:%d: Expected %u but got %u\n", \
              __FILE__, __LINE__, (unsigned)(expected), (unsigned)(actual)); \
      exit(1); \
    } \
  } while (0)

static void test_vector_aggregates(void) {
  printf("Testing vector aggregates (sum, mean, min, max, dot, var)...\n");

  double data[] = { 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5 };
  size_t n = sizeof(data) / sizeof(data[0]);

  double sum = trellis_vector_sum_f64(data, n);
  ASSERT_CLOSE(sum, 60.0, 1e-9);

  double mean = trellis_vector_mean_f64(data, n);
  ASSERT_CLOSE(mean, 6.0, 1e-9);

  double min_val = trellis_vector_min_f64(data, n);
  ASSERT_CLOSE(min_val, 1.5, 1e-9);

  double max_val = trellis_vector_max_f64(data, n);
  ASSERT_CLOSE(max_val, 10.5, 1e-9);

  double dot = trellis_vector_dot_f64(data, data, n);
  ASSERT_CLOSE(dot, 442.5, 1e-9);

  double var_samp = trellis_vector_variance_f64(data, n, 1);
  ASSERT_CLOSE(var_samp, 9.166666666666666, 1e-7);

  printf("PASS: Vector aggregates valid.\n");
}

static void test_matrix_operations(void) {
  printf("Testing cache-blocked matrix multiplication and transpose...\n");

  // A is 2x3, B is 3x2
  // A = [ [1, 2, 3], [4, 5, 6] ]
  // B = [ [7, 8], [9, 1], [2, 3] ]
  // C = A x B = [ [31, 19], [85, 55] ]
  double a[] = { 1, 2, 3, 4, 5, 6 };
  double b[] = { 7, 8, 9, 1, 2, 3 };
  double c[4] = { 0 };

  trellis_matrix_multiply_f64(a, b, c, 2, 3, 2);
  ASSERT_CLOSE(c[0], 31.0, 1e-9);
  ASSERT_CLOSE(c[1], 19.0, 1e-9);
  ASSERT_CLOSE(c[2], 85.0, 1e-9);
  ASSERT_CLOSE(c[3], 55.0, 1e-9);

  // Transpose of A (2x3 -> 3x2)
  // A^T = [ [1, 4], [2, 5], [3, 6] ]
  double at[6] = { 0 };
  trellis_matrix_transpose_f64(a, at, 2, 3);
  ASSERT_CLOSE(at[0], 1.0, 1e-9);
  ASSERT_CLOSE(at[1], 4.0, 1e-9);
  ASSERT_CLOSE(at[2], 2.0, 1e-9);
  ASSERT_CLOSE(at[3], 5.0, 1e-9);
  ASSERT_CLOSE(at[4], 3.0, 1e-9);
  ASSERT_CLOSE(at[5], 6.0, 1e-9);

  printf("PASS: Matrix operations valid.\n");
}

static void test_crc32c(void) {
  printf("Testing Castagnoli CRC32-C verification...\n");

  // Standard benchmark string "123456789" with Castagnoli polynomial yields 0xE3069283
  const char* test_str = "123456789";
  uint32_t crc = trellis_crc32c((const uint8_t*)test_str, strlen(test_str), 0);
  ASSERT_EQ(crc, 0xE3069283);

  printf("PASS: Castagnoli CRC32-C checksums verified.\n");
}

int main(void) {
  printf("=== Trellis Native C Verification Suite ===\n");
  test_vector_aggregates();
  test_matrix_operations();
  test_crc32c();
  printf("ALL NATIVE TESTS PASSED (3/3 suites clean).\n");
  return 0;
}
