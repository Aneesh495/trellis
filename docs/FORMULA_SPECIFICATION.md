# Formula Language Specification and Function Catalog

This document specifies the formal lexical grammar, Pratt operator precedence hierarchy, and comprehensive standard library functions supported by the Trellis calculation engine.

## 1. Formal Grammar (EBNF)

```ebnf
Formula           ::= "=" Expression
Expression        ::= LogicalOrExpr
LogicalOrExpr     ::= LogicalAndExpr ( "OR" LogicalAndExpr )*
LogicalAndExpr    ::= ComparisonExpr ( "AND" ComparisonExpr )*
ComparisonExpr    ::= ConcatExpr ( ( "=" | "<>" | "<" | "<=" | ">" | ">=" ) ConcatExpr )*
ConcatExpr        ::= AddSubExpr ( "&" AddSubExpr )*
AddSubExpr        ::= MulDivExpr ( ( "+" | "-" ) MulDivExpr )*
MulDivExpr        ::= PowerExpr ( ( "*" | "/" ) PowerExpr )*
PowerExpr         ::= UnaryExpr ( "^" UnaryExpr )*
UnaryExpr         ::= ( "+" | "-" ) UnaryExpr | PostfixExpr
PostfixExpr       ::= PrimaryExpr ( "%" | "#" )*
PrimaryExpr       ::= Literal | CellRef | RangeRef | FunctionCall | LetExpr | LambdaExpr | "(" Expression ")"
Literal           ::= NumberLiteral | StringLiteral | BooleanLiteral | ErrorLiteral | ArrayLiteral
ArrayLiteral      ::= "{" ArrayRow ( ";" ArrayRow )* "}"
ArrayRow          ::= Expression ( "," Expression )*
LetExpr           ::= "LET" "(" ( Identifier "," Expression "," )+ Expression ")"
LambdaExpr        ::= "LAMBDA" "(" ( Identifier "," )* Expression ")"
FunctionCall      ::= Identifier "(" [ ArgumentList ] ")"
ArgumentList      ::= Expression ( "," [ Expression ] )*
```

## 2. Operator Precedence Hierarchy

The Trellis Pratt parser assigns deterministic left and right binding powers to every operator token:

| Operator | Associativity | Precedence | Description |
|:---|:---|:---|:---|
| `%`, `#` | Left | 80 | Percentage scaling, Spill range reference |
| `^` | Right | 70 | Exponentiation |
| `+`, `-` (Unary) | Right | 60 | Unary plus and negation |
| `*`, `/` | Left | 50 | Multiplication and division |
| `+`, `-` (Binary) | Left | 40 | Addition and subtraction |
| `&` | Left | 30 | String concatenation |
| `=`, `<>`, `<`, `<=`, `>`, `>=` | Left | 20 | Equality and relational comparison |

## 3. Function Library Catalog (170+ Functions)

### 3.1 Mathematical and Matrix Primitives
- `SUM(val1, ...)`: Sum of all numbers across scalars and matrices.
- `PRODUCT(val1, ...)`: Product of all numbers.
- `ROUND(val, digits)`: Mathematical rounding to specified precision.
- `ABS(val)`: Absolute value of a real number.
- `SQRT(val)`: Square root of a positive real number.
- `POWER(base, exp)`: Power calculation $base^{exp}$.
- `MOD(n, d)`: Modulo remainder after division.
- `MMULT(m1, m2)`: Matrix multiplication of two compatible 2D matrices.
- `SUMPRODUCT(arr1, arr2, ...)`: Component-wise multiplication and summation.
- `SUMIF(range, criterion, [sum_range])`: Conditional summation matching criteria.

### 3.2 Statistical Analysis and Quantiles
- `AVERAGE(val1, ...)`: Arithmetic mean.
- `AVERAGEIF(range, criterion, [avg_range])`: Conditional arithmetic mean.
- `COUNT(val1, ...)`: Count of cells containing numbers.
- `COUNTA(val1, ...)`: Count of non-blank cells.
- `COUNTBLANK(range)`: Count of empty cells.
- `COUNTIF(range, criterion)`: Count of cells matching criteria.
- `MIN(val1, ...)`, `MAX(val1, ...)`: Minimum and maximum values.
- `MEDIAN(val1, ...)`: Median value.
- `STDEV.S(val1, ...)`, `STDEV.P(val1, ...)`: Sample and population standard deviations.
- `VAR.S(val1, ...)`, `VAR.P(val1, ...)`: Sample and population variances.
- `CORREL(arr1, arr2)`: Pearson correlation coefficient.
- `SLOPE(y, x)`, `INTERCEPT(y, x)`: Ordinary least squares linear regression.
- `FORECAST(x, known_y, known_x)`: Linear regression extrapolation.
- `NORM.DIST(x, mean, stdev, cumulative)`: Gaussian normal distribution PDF or CDF.
- `NORM.INV(probability, mean, stdev)`: Inverse Gaussian quantile function.
- `COVARIANCE.S(arr1, arr2)`, `COVARIANCE.P(arr1, arr2)`: Sample and population covariances.
- `PERCENTILE.INC(arr, k)`: Linear percentile interpolation for $k \in [0, 1]$.
- `QUARTILE.INC(arr, quart)`: Quartile values (0, 1, 2, 3, 4).
- `MODE.SNGL(arr)`: Most frequent number in a series.

### 3.3 Quantitative Finance and Fixed Assets
- `NPV(rate, flow1, ...)`: Net present value of periodic cash flows.
- `XNPV(rate, values, dates)`: Net present value for irregular cash flow schedules.
- `IRR(flows, [guess])`: Internal rate of return via Newton-Raphson iteration.
- `MIRR(values, finance_rate, reinvest_rate)`: Modified internal rate of return.
- `PV(rate, nper, pmt, [fv], [type])`: Present value of an annuity.
- `FV(rate, nper, pmt, [pv], [type])`: Future value of an annuity.
- `PMT(rate, nper, pv, [fv], [type])`: Periodic payment for an annuity.
- `NPER(rate, pmt, pv, [fv], [type])`: Number of periods.
- `RATE(nper, pmt, pv, [fv], [type], [guess])`: Interest rate per period.
- `EFFECT(nominal_rate, npery)`: Effective annual interest rate.
- `NOMINAL(effect_rate, npery)`: Nominal annual interest rate.
- `SLN(cost, salvage, life)`: Straight-line depreciation.
- `SYD(cost, salvage, life, per)`: Sum-of-years digits depreciation.
- `DB(cost, salvage, life, period, [month])`: Fixed-declining balance depreciation.
- `DDB(cost, salvage, life, period, [factor])`: Double-declining balance depreciation.

### 3.4 Calendar, DateTime, and Day-Count Fractions
- `DATE(year, month, day)`: Gregorian serial number.
- `TIME(hour, minute, second)`: 24-hour day fraction.
- `YEAR(date)`, `MONTH(date)`, `DAY(date)`: Calendar components.
- `HOUR(time)`, `MINUTE(time)`, `SECOND(time)`: Time components.
- `TODAY()`, `NOW()`: Current date and timestamp (volatile).
- `EDATE(start, months)`: Shifts date by months.
- `EOMONTH(start, months)`: End of month after shifting.
- `WORKDAY(start, days, [holidays])`: Adds business days excluding weekends and holidays.
- `NETWORKDAYS(start, end, [holidays])`: Whole working days between dates.
- `DAYS360(start, end, [method])`: Day count based on a 360-day corporate bond year.
- `ISOWEEKNUM(date)`: ISO 8601 calendar week number.
- `YEARFRAC(start, end, [basis])`: Financial day-count fraction under conventions 0 (US 30/360), 1 (Actual/Actual), 2 (Actual/360), 3 (Actual/365), and 4 (European 30/360).

### 3.5 Dynamic Array Combinators and Higher-Order Lambdas
- `SEQUENCE(rows, [cols], [start], [step])`: Generates a contiguous 2D arithmetic grid.
- `UNIQUE(array)`: Distinct elements along rows or columns.
- `FILTER(array, include, [if_empty])`: Row filtering matching boolean criteria.
- `SORT(array, [sort_index], [sort_order])`: Multi-key sorting.
- `SORTBY(array, by_array, [order])`: Sorts an array based on values in an aligned vector.
- `MAP(array1, [array2], lambda)`: Applies a `LAMBDA` over elements to yield a mapped matrix.
- `REDUCE(initial, array, lambda)`: Accumulates an array into a single result.
- `SCAN(initial, array, lambda)`: Returns running intermediate accumulator values.
- `BYROW(array, lambda)`: Applies a `LAMBDA` reduction across each row.
- `BYCOL(array, lambda)`: Applies a `LAMBDA` reduction across each column.
- `MAKEARRAY(rows, cols, lambda)`: Synthesizes a matrix given `LAMBDA(row, col)`.

### 3.6 String Manipulation and Regular Expressions
- `CONCAT(text1, ...)`: Concatenates strings and ranges.
- `TEXTJOIN(delimiter, ignore_empty, text1, ...)`: Joins strings with custom separators.
- `LEFT(text, [num])`, `RIGHT(text, [num])`: Leading and trailing character substrings.
- `MID(text, start, length)`: Interior substring extraction.
- `LEN(text)`: String length.
- `FIND(find_text, within_text, [start])`: Case-sensitive character offset.
- `SEARCH(find_text, within_text, [start])`: Case-insensitive character offset with wildcards.
- `SUBSTITUTE(text, old_text, new_text, [instance])`: Replaces substring occurrences.
- `TEXTSPLIT(text, col_delim, [row_delim])`: Splits strings into a 2D matrix.
- `TEXTBEFORE(text, delim, [instance])`: Substring prior to delimiter match.
- `TEXTAFTER(text, delim, [instance])`: Substring following delimiter match.
- `VALUETOTEXT(val, [strict])`: Formats scalar to string representation.
- `ARRAYTOTEXT(arr, [strict])`: Formats 2D matrix into text array literal.
- `REGEXMATCH(text, pattern)`: Evaluates whether regular expression matches text.
- `REGEXEXTRACT(text, pattern)`: Extracts captured group or substring matching pattern.
- `REGEXREPLACE(text, pattern, replacement)`: Replaces regex pattern occurrences.
