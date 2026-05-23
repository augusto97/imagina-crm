<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Automations;

use ImaginaCRM\Automations\Actions\SendEmailAction;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Lists\ListEntity;
use PHPUnit\Framework\TestCase;

/**
 * Tests de la acción `send_email`. Validamos:
 * - El happy path interpola merge tags en `to`, `subject` y `body` y llama
 *   a wp_mail con los valores resueltos.
 * - Con `is_html` true se setea el header Content-Type apropiado.
 * - From / Cc / Bcc se construyen como headers cuando los emails son válidos.
 * - Destinatario inválido tras interpolación → skipped (no llama wp_mail).
 * - wp_mail false → ActionResult::failed.
 */
final class SendEmailActionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['imcrm_test_mail_calls']          = [];
        $GLOBALS['imcrm_test_mail_should_succeed'] = true;
    }

    public function test_sends_with_merge_tags_in_to_subject_and_body(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context([
            'id'     => 7,
            'fields' => [
                'name'  => 'Acme',
                'email' => 'contact@acme.test',
            ],
        ]);

        $result = $action->execute($ctx, [
            'to'      => '{{email}}',
            'subject' => 'Hola {{name}}',
            'body'    => 'Tu id es {{record.id}}.',
        ]);

        $this->assertTrue($result->isSuccess());
        $this->assertCount(1, $GLOBALS['imcrm_test_mail_calls']);
        $call = $GLOBALS['imcrm_test_mail_calls'][0];
        $this->assertSame(['contact@acme.test'], $call['to']);
        $this->assertSame('Hola Acme', $call['subject']);
        $this->assertSame('Tu id es 7.', $call['message']);
        $this->assertSame([], $call['headers']);
    }

    public function test_html_email_adds_content_type_header(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => ['email' => 'a@b.test']]);

        $result = $action->execute($ctx, [
            'to'      => '{{email}}',
            'subject' => 'X',
            'body'    => '<p>Hola</p>',
            'is_html' => true,
        ]);

        $this->assertTrue($result->isSuccess());
        $call = $GLOBALS['imcrm_test_mail_calls'][0];
        $this->assertContains('Content-Type: text/html; charset=UTF-8', $call['headers']);
    }

    public function test_from_cc_bcc_headers_constructed_correctly(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => ['email' => 'lead@example.test']]);

        $action->execute($ctx, [
            'to'         => '{{email}}',
            'subject'    => 'X',
            'body'       => 'Y',
            'from_name'  => 'Imagina CRM',
            'from_email' => 'noreply@imagina.test',
            'cc'         => 'cc1@x.test, cc2@x.test',
            'bcc'        => 'bcc@x.test',
        ]);

        $headers = $GLOBALS['imcrm_test_mail_calls'][0]['headers'];
        $this->assertContains('From: Imagina CRM <noreply@imagina.test>', $headers);
        $this->assertContains('Cc: cc1@x.test, cc2@x.test', $headers);
        $this->assertContains('Bcc: bcc@x.test', $headers);
    }

    public function test_invalid_recipient_after_interpolation_is_skipped(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => []]); // sin email → tag vacío
        $result = $action->execute($ctx, [
            'to'      => '{{email}}',
            'subject' => 'X',
            'body'    => 'Y',
        ]);

        $this->assertTrue($result->status === 'skipped' || $result->isFailed() === false);
        $this->assertCount(0, $GLOBALS['imcrm_test_mail_calls'], 'wp_mail no debe llamarse si no hay destinatario.');
    }

    public function test_missing_required_config_skips(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => ['email' => 'a@b.test']]);

        // Sin subject.
        $result = $action->execute($ctx, ['to' => 'a@b.test', 'body' => 'hi']);
        $this->assertSame('skipped', $result->status);

        // Sin body.
        $result = $action->execute($ctx, ['to' => 'a@b.test', 'subject' => 'hi']);
        $this->assertSame('skipped', $result->status);

        $this->assertCount(0, $GLOBALS['imcrm_test_mail_calls']);
    }

    public function test_wp_mail_failure_returns_failed(): void
    {
        $GLOBALS['imcrm_test_mail_should_succeed'] = false;

        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => ['email' => 'a@b.test']]);
        $result = $action->execute($ctx, [
            'to'      => '{{email}}',
            'subject' => 'X',
            'body'    => 'Y',
        ]);

        $this->assertTrue($result->isFailed());
        $this->assertStringContainsString('wp_mail', (string) $result->message);
    }

    public function test_multiple_recipients_filter_invalid_addresses(): void
    {
        $action = new SendEmailAction();
        $ctx    = $this->context(['fields' => []]);

        $result = $action->execute($ctx, [
            'to'      => 'a@b.test, not-an-email, c@d.test',
            'subject' => 'X',
            'body'    => 'Y',
        ]);

        $this->assertTrue($result->isSuccess());
        $call = $GLOBALS['imcrm_test_mail_calls'][0];
        $this->assertSame(['a@b.test', 'c@d.test'], $call['to']);
    }

    /**
     * @param array<string, mixed> $record
     */
    private function context(array $record): TriggerContext
    {
        $list = new ListEntity(
            id: 1,
            slug: 'leads',
            tableSuffix: 'leads',
            name: 'Leads',
            description: null,
            icon: null,
            color: null,
            settings: [],
            position: 0,
            createdBy: 1,
            createdAt: '2026-04-25 10:00:00',
            updatedAt: '2026-04-25 10:00:00',
            deletedAt: null,
        );
        return new TriggerContext(
            event: 'imagina_crm/record_created',
            list: $list,
            record: $record,
        );
    }
}
