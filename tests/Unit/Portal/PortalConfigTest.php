<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Portal;

use ImaginaCRM\Portal\PortalConfig;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del value object que parsea `wp_imcrm_lists.settings.portal`.
 */
final class PortalConfigTest extends TestCase
{
    public function test_disabled_when_no_portal_key(): void
    {
        $cfg = PortalConfig::fromListSettings([]);
        $this->assertFalse($cfg->enabled);
        $this->assertFalse($cfg->isPortalList());
        $this->assertNull($cfg->ownerFieldId);
    }

    public function test_disabled_when_portal_is_not_array(): void
    {
        $cfg = PortalConfig::fromListSettings(['portal' => true]);
        $this->assertFalse($cfg->enabled);
    }

    public function test_enabled_but_no_owner_field_is_not_portal_list(): void
    {
        // enabled=true pero sin owner_field_id → no podemos resolver
        // cliente, por defensa el service NO considera portal.
        $cfg = PortalConfig::fromListSettings([
            'portal' => ['enabled' => true],
        ]);
        $this->assertTrue($cfg->enabled);
        $this->assertNull($cfg->ownerFieldId);
        $this->assertFalse($cfg->isPortalList(), 'isPortalList exige owner_field_id');
    }

    public function test_full_shape(): void
    {
        $cfg = PortalConfig::fromListSettings([
            'portal' => [
                'enabled'             => true,
                'owner_field_id'      => 42,
                'default_template_id' => 7,
            ],
        ]);
        $this->assertTrue($cfg->enabled);
        $this->assertSame(42, $cfg->ownerFieldId);
        $this->assertSame(7, $cfg->defaultTemplateId);
        $this->assertTrue($cfg->isPortalList());
    }

    public function test_invalid_owner_field_id_treated_as_null(): void
    {
        $cfg = PortalConfig::fromListSettings([
            'portal' => ['enabled' => true, 'owner_field_id' => 'not-numeric'],
        ]);
        $this->assertNull($cfg->ownerFieldId);
        $this->assertFalse($cfg->isPortalList());
    }

    public function test_zero_or_negative_owner_field_id_treated_as_null(): void
    {
        $cfg1 = PortalConfig::fromListSettings([
            'portal' => ['enabled' => true, 'owner_field_id' => 0],
        ]);
        $this->assertNull($cfg1->ownerFieldId);

        $cfg2 = PortalConfig::fromListSettings([
            'portal' => ['enabled' => true, 'owner_field_id' => -5],
        ]);
        $this->assertNull($cfg2->ownerFieldId);
    }

    public function test_disabled_factory(): void
    {
        $cfg = PortalConfig::disabled();
        $this->assertFalse($cfg->enabled);
        $this->assertFalse($cfg->isPortalList());
    }

    public function test_to_array_roundtrip(): void
    {
        $cfg = PortalConfig::fromListSettings([
            'portal' => [
                'enabled'             => true,
                'owner_field_id'      => 42,
                'default_template_id' => 7,
            ],
        ]);
        $this->assertSame([
            'enabled'             => true,
            'owner_field_id'      => 42,
            'default_template_id' => 7,
        ], $cfg->toArray());
    }
}
