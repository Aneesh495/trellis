/**
 * Castagnoli CRC32-C (0x82F63B78) checksum acceleration with Slice-by-8 fallback.
 */

#include "../include/trellis.h"

#define CRC32C_POLYNOMIAL 0x82F63B78

static uint32_t crc32c_table[8][256];
static int table_initialized = 0;

static void init_crc32c_tables(void) {
  for (uint32_t i = 0; i < 256; i++) {
    uint32_t c = i;
    for (int j = 0; j < 8; j++) {
      c = (c & 1) ? (CRC32C_POLYNOMIAL ^ (c >> 1)) : (c >> 1);
    }
    crc32c_table[0][i] = c;
  }

  for (int i = 0; i < 256; i++) {
    for (int slice = 1; slice < 8; slice++) {
      crc32c_table[slice][i] =
          (crc32c_table[slice - 1][i] >> 8) ^
          crc32c_table[0][crc32c_table[slice - 1][i] & 0xFF];
    }
  }
  table_initialized = 1;
}

uint32_t trellis_crc32c(const uint8_t* data, size_t length, uint32_t initial_crc) {
  if (data == NULL || length == 0) {
    return initial_crc;
  }

  if (!table_initialized) {
    init_crc32c_tables();
  }

  uint32_t crc = ~initial_crc;
  const uint8_t* p = data;

  // Process 8 bytes per iteration using Slice-by-8
  while (length >= 8) {
    uint32_t term1 = crc ^ *(const uint32_t*)p;
    uint32_t term2 = *(const uint32_t*)(p + 4);

    crc = crc32c_table[7][term1 & 0xFF] ^
          crc32c_table[6][(term1 >> 8) & 0xFF] ^
          crc32c_table[5][(term1 >> 16) & 0xFF] ^
          crc32c_table[4][term1 >> 24] ^
          crc32c_table[3][term2 & 0xFF] ^
          crc32c_table[2][(term2 >> 8) & 0xFF] ^
          crc32c_table[1][(term2 >> 16) & 0xFF] ^
          crc32c_table[0][term2 >> 24];

    p += 8;
    length -= 8;
  }

  // Remainder bytes
  while (length > 0) {
    crc = crc32c_table[0][(crc ^ *p++) & 0xFF] ^ (crc >> 8);
    length--;
  }

  return ~crc;
}
