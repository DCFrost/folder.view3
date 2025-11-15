<?php

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__ . '/src/folder.view2')
    ->name('*.php')
    ->notPath('include') 
    ->notPath('scripts/include')
    ->notPath('styles/include')
    ->ignoreDotFiles(true)
    ->ignoreVCS(true);

$config = new PhpCsFixer\Config();
return $config
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'no_unused_imports' => true,
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_closing_tag' => true,  // Remove ?> from files
        'single_blank_line_at_eof' => true,
        'blank_line_after_opening_tag' => true,
        'no_whitespace_in_blank_line' => true,
        'trailing_comma_in_multiline' => ['elements' => ['arrays']],
    ])
    ->setFinder($finder)
    ->setRiskyAllowed(false);
