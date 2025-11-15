<?php

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__ . '/src/folder.view2/usr/local/emhttp/plugins/folder.view2/server')
    ->name('*.php');

$config = new PhpCsFixer\Config();
return $config
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
        'single_quote' => true,
        'binary_operator_spaces' => [
            'default' => 'single_space',
        ],
        'blank_line_after_opening_tag' => true,
        'concat_space' => ['spacing' => 'one'],
        'no_extra_blank_lines' => true,
        'no_trailing_whitespace' => true,
        'no_whitespace_in_blank_line' => true,
    ])
    ->setFinder($finder);
