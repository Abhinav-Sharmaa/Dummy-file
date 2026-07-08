<?php
declare(strict_types=1);

/**
 * Deterministic, rule-based generation. The ticket description (pasted from the
 * internal tool) is the single source of truth: keyword signals select typed
 * templates, and acceptance-criteria-style lines are lifted into their own case.
 *
 * Guarantees:
 *  - >= 3 test cases per run
 *  - every case targets all 3 mandatory viewports
 *  - exactly one case of type "iframe" covering the embedded banking widget
 */
final class TestCaseGenerator
{
    private const DEVICES = ['desktop', 'tablet', 'mobile'];

    public static function generate(string $ticket, string $url): array
    {
        $t     = strtolower($ticket);
        $host  = parse_url($url, PHP_URL_HOST) ?: $url;
        $cases = [];

        // 1. Always: smoke — load, layout integrity, no horizontal overflow per viewport.
        $cases[] = self::make('smoke', 'Page loads with intact responsive layout', [
            'Target URL is reachable',
        ], [
            "Navigate to {$url}",
            'Wait for the page to reach network-idle / DOM loaded state',
            'Verify the document title is non-empty',
            'Verify the page body renders visible content',
            'Verify no horizontal overflow at the active viewport width',
        ], 'Page renders on every viewport with a non-empty title, visible content, and no horizontal scrollbar.');

        // 2. Keyword-driven templates.
        if (preg_match('/log[- ]?in|sign[- ]?in|authenticat/', $t)) {
            $cases[] = self::make('navigation', 'Login entry point is reachable', [
                'User is logged out',
            ], [
                "Navigate to {$url}",
                'Locate the login entry point (link or button) on the page',
                'Verify it is visible and enabled at the active viewport',
                'Activate it and verify the login UI is presented',
            ], 'A login entry point is discoverable and functional on desktop, tablet and mobile.');
        }

        if (preg_match('/\bform\b|input|field|validat|submit|required/', $t)) {
            $cases[] = self::make('form', 'On-page form validates and submits', [
                'Target URL is reachable',
                'A form exists on the page outside the banking widget iframe',
            ], [
                "Navigate to {$url}",
                'Locate the first form on the page (excluding the banking widget iframe)',
                'Submit the form empty and verify a validation message appears',
                'Fill all text/email inputs with valid sample data',
                'Submit the form',
                'Verify a success or status message is shown',
            ], 'Empty submit is blocked with a visible validation message; valid submit produces a visible success state.');
        }

        if (preg_match('/\bnav\b|navigation|menu|header|footer|hamburger/', $t)) {
            $cases[] = self::make('navigation', 'Primary navigation works per device', [
                'Target URL is reachable',
            ], [
                "Navigate to {$url}",
                'On mobile: open the collapsed menu control if present',
                'Verify the primary navigation is visible',
                'Verify navigation links expose non-empty href targets',
            ], 'Primary navigation is operable on all three viewports, including the collapsed mobile state.');
        }

        if (preg_match('/search/', $t)) {
            $cases[] = self::make('acceptance', 'Search is available and accepts input', [
                'Target URL is reachable',
            ], [
                "Navigate to {$url}",
                'Locate the search input',
                'Type a sample query "test"',
                'Submit and verify the page responds (results area or navigation)',
            ], 'Search input is present, accepts text, and submission produces a visible response.');
        }

        // 3. Acceptance-criteria lines lifted verbatim from the ticket.
        $criteria = self::extractCriteria($ticket);
        if ($criteria !== []) {
            $steps = ["Navigate to {$url}"];
            foreach ($criteria as $line) {
                $steps[] = 'Verify: ' . $line;
            }
            $cases[] = self::make('acceptance', 'Ticket acceptance criteria hold on-page', [
                'Ticket changes are deployed to the target URL',
            ], $steps, 'Every acceptance criterion listed in the ticket is observable on the rendered page. Quoted text in criteria is asserted visible; the rest is structurally verified and human-reviewed.');
        }

        // 4. Mandatory: banking widget iframe coverage (frame locator flow).
        $cases[] = self::make('iframe', 'Banking widget iframe: locate, authenticate, validate', [
            'Target URL is reachable',
            "Page on {$host} exposes the third-party banking widget (iframe preferred, inline supported)",
            'Widget test credentials available; defaults qa_demo_user / S3cure!Demo, override via WIDGET_USER / WIDGET_PASS env',
        ], [
            "Navigate to {$url}",
            'Locate the banking widget: iframe via Playwright frame locator first, inline widget as fallback',
            'On tablet/mobile: reveal the collapsed login panel if needed',
            'Fill the username / Logon ID field with the test credential',
            'Fill the password / security code field with the test credential',
            'Submit the widget login form',
            'Verify the widget responds visibly (in-widget message or navigation to the provider)',
        ], 'Widget is located (frame locator preferred), credential fields accept input, and submit produces an observable response on all three viewports. A real signed-in state additionally requires valid test credentials via WIDGET_USER / WIDGET_PASS.');

        // 5. Floor: guarantee at least 3 cases.
        if (count($cases) < 3) {
            $cases[] = self::make('navigation', 'Interactive elements respond at every viewport', [
                'Target URL is reachable',
            ], [
                "Navigate to {$url}",
                'Verify at least one link or button is visible and enabled',
                'Verify tap targets remain operable at mobile width',
            ], 'Core interactive elements are visible and enabled on desktop, tablet and mobile.');
        }

        // Assign stable IDs.
        foreach ($cases as $i => &$case) {
            $case['id'] = sprintf('TC-%03d', $i + 1);
        }

        return $cases;
    }

    private static function make(string $type, string $title, array $pre, array $steps, string $expected): array
    {
        return [
            'id'            => '',
            'type'          => $type,
            'title'         => $title,
            'preconditions' => $pre,
            'steps'         => $steps,
            'expected'      => $expected,
            'devices'       => self::DEVICES,     // mandatory coverage, not editable
            'status'        => 'pending',          // pending | approved | rejected
        ];
    }

    /** Pull bullet / "should|must|verify|ensure" lines out of the ticket, capped at 6. */
    private static function extractCriteria(string $ticket): array
    {
        $out = [];
        foreach (preg_split('/\R/', $ticket) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || strlen($line) < 8) {
                continue;
            }
            $isBullet  = (bool) preg_match('/^([-*•]|\d+[.)])\s+/', $line);
            $isCriteria = (bool) preg_match('/\b(should|must|verify|ensure|expects?)\b/i', $line);
            if ($isBullet || $isCriteria) {
                $out[] = preg_replace('/^([-*•]|\d+[.)])\s+/', '', $line);
            }
            if (count($out) >= 6) {
                break;
            }
        }
        return $out;
    }
}
