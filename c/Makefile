CC ?= cc
CFLAGS ?= -O3 -Wall -Wextra -std=c99 -fPIC -Iinclude
UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Darwin)
	SHLIB_EXT := dylib
	SHLIB_FLAGS := -dynamiclib
else
	SHLIB_EXT := so
	SHLIB_FLAGS := -shared
endif

BUILD_DIR := build
SRCS := src/vector_math.c src/matrix.c src/crc32.c
OBJS := $(patsubst src/%.c,$(BUILD_DIR)/%.o,$(SRCS))
TARGET_LIB := $(BUILD_DIR)/libtrellis.$(SHLIB_EXT)
TARGET_STATIC := $(BUILD_DIR)/libtrellis.a
TEST_BIN := $(BUILD_DIR)/test_c_vector

.PHONY: all clean test

all: $(TARGET_LIB) $(TARGET_STATIC)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.o: src/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET_LIB): $(OBJS)
	$(CC) $(SHLIB_FLAGS) -o $@ $(OBJS)

$(TARGET_STATIC): $(OBJS)
	ar rcs $@ $(OBJS)

test: $(TEST_BIN)
	./$(TEST_BIN)

$(TEST_BIN): tests/test_c_vector.c $(OBJS) | $(BUILD_DIR)
	$(CC) $(CFLAGS) $< $(OBJS) -lm -o $@

clean:
	rm -rf $(BUILD_DIR)
