<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Imports;

use ImaginaCRM\Imports\CsvParser;
use PHPUnit\Framework\TestCase;

final class CsvParserTest extends TestCase
{
    public function test_parses_simple_csv_with_header(): void
    {
        $csv = "name,email\nAna,a@x.com\nLuis,l@x.com\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['name', 'email'], $parsed['headers']);
        $this->assertSame(
            [['Ana', 'a@x.com'], ['Luis', 'l@x.com']],
            $parsed['rows'],
        );
    }

    public function test_strips_utf8_bom(): void
    {
        $csv = "\xEF\xBB\xBFname,email\nAna,a@x.com\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame('name', $parsed['headers'][0]);
        $this->assertNotSame('﻿name', $parsed['headers'][0]);
    }

    public function test_handles_quoted_cells_with_commas(): void
    {
        $csv = "name,note\n\"Pérez, Ana\",\"hola, mundo\"\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['Pérez, Ana', 'hola, mundo'], $parsed['rows'][0]);
    }

    public function test_handles_multiline_quoted_cells(): void
    {
        $csv = "name,note\nAna,\"línea 1\nlínea 2\"\nLuis,solo\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['Ana', "línea 1\nlínea 2"], $parsed['rows'][0]);
        $this->assertSame(['Luis', 'solo'], $parsed['rows'][1]);
    }

    public function test_handles_escaped_double_quotes(): void
    {
        $csv = "title\n\"She said \"\"hi\"\"\"\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['title'], $parsed['headers']);
        $this->assertSame(['She said "hi"'], $parsed['rows'][0]);
    }

    public function test_detects_semicolon_delimiter(): void
    {
        // Excel ES exporta con `;` por la coma decimal española.
        $csv = "name;total\nAna;1.234,56\nLuis;500\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['name', 'total'], $parsed['headers']);
        $this->assertSame(['Ana', '1.234,56'], $parsed['rows'][0]);
    }

    public function test_detects_tab_delimiter(): void
    {
        $csv = "name\temail\nAna\ta@x.com\n";
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['name', 'email'], $parsed['headers']);
        $this->assertSame(['Ana', 'a@x.com'], $parsed['rows'][0]);
    }

    public function test_explicit_delimiter_overrides_detection(): void
    {
        $csv = "a,b\n1;2\n3;4\n";
        $parsed = CsvParser::parse($csv, ';');

        $this->assertSame(['a,b'], $parsed['headers']);
        $this->assertSame(['1', '2'], $parsed['rows'][0]);
    }

    public function test_empty_csv_returns_empty_arrays(): void
    {
        $parsed = CsvParser::parse('');
        $this->assertSame([], $parsed['headers']);
        $this->assertSame([], $parsed['rows']);
    }

    public function test_only_header_returns_empty_rows(): void
    {
        $parsed = CsvParser::parse("a,b,c\n");
        $this->assertSame(['a', 'b', 'c'], $parsed['headers']);
        $this->assertSame([], $parsed['rows']);
    }

    public function test_normalizes_latin1_encoding_to_utf8(): void
    {
        $latin1 = mb_convert_encoding("name,city\nLuis,Bogotá\n", 'Windows-1252', 'UTF-8');
        $this->assertIsString($latin1);
        $parsed = CsvParser::parse($latin1);

        $this->assertSame('Bogotá', $parsed['rows'][0][1]);
    }

    public function test_build_round_trips_simple_data(): void
    {
        $csv = CsvParser::build(
            ['id', 'name'],
            [[1, 'Ana'], [2, 'Luis']],
        );

        // Debe traer BOM al inicio para que Excel reconozca UTF-8.
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);

        // Round-trip parse → estructura idéntica.
        $parsed = CsvParser::parse($csv);
        $this->assertSame(['id', 'name'], $parsed['headers']);
        $this->assertSame([['1', 'Ana'], ['2', 'Luis']], $parsed['rows']);
    }

    public function test_build_quotes_values_with_commas(): void
    {
        $csv = CsvParser::build(['note'], [['hola, mundo'], ['simple']]);
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['hola, mundo'], $parsed['rows'][0]);
        $this->assertSame(['simple'], $parsed['rows'][1]);
    }

    public function test_build_handles_null_values_as_empty_string(): void
    {
        $csv = CsvParser::build(['a', 'b'], [['x', null]]);
        $parsed = CsvParser::parse($csv);

        $this->assertSame(['x', ''], $parsed['rows'][0]);
    }
}
