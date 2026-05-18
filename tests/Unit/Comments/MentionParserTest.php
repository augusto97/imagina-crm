<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Comments;

use ImaginaCRM\Comments\MentionParser;
use PHPUnit\Framework\TestCase;

/**
 * Tests del parser de menciones. El resolver es inyectable, así que aquí
 * usamos un mapa estático sin tocar `get_user_by` real.
 */
final class MentionParserTest extends TestCase
{
    public function test_extracts_simple_mentions_in_order(): void
    {
        $parser = new MentionParser();
        $logins = $parser->extractLogins('Hola @maria y @juan, ¿qué piensan?');
        $this->assertSame(['maria', 'juan'], $logins);
    }

    public function test_does_not_match_email_addresses(): void
    {
        $parser = new MentionParser();
        $this->assertSame([], $parser->extractLogins('Escríbele a foo@example.com'));
    }

    public function test_deduplicates_case_insensitively(): void
    {
        $parser = new MentionParser();
        $logins = $parser->extractLogins('@maria @MARIA @maria.gomez');
        $this->assertSame(['maria', 'maria.gomez'], $logins);
    }

    public function test_supports_dots_dashes_underscores_in_login(): void
    {
        $parser = new MentionParser();
        $this->assertSame(
            ['maria.gomez', 'juan-perez', 'sam_torres'],
            $parser->extractLogins('cc: @maria.gomez @juan-perez @sam_torres'),
        );
    }

    public function test_resolve_uses_resolver_and_drops_unknown_logins(): void
    {
        $resolver = static fn (string $login): ?int => match ($login) {
            'maria' => 12,
            'juan'  => 18,
            default => null,
        };
        $parser = new MentionParser(\Closure::fromCallable($resolver));

        $resolved = $parser->resolve('cc @maria @ghost @juan');
        $this->assertSame(['maria' => 12, 'juan' => 18], $resolved);
    }

    public function test_extracts_at_start_of_string(): void
    {
        $parser = new MentionParser();
        $this->assertSame(['maria'], $parser->extractLogins('@maria buenos días'));
    }

    public function test_handles_multiline_content(): void
    {
        $parser = new MentionParser();
        $logins = $parser->extractLogins("Primera línea con @maria\nSegunda con @juan");
        $this->assertSame(['maria', 'juan'], $logins);
    }
}
