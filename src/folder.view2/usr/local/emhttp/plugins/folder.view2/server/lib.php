<?php

define('FV2_DEBUG_MODE', false); // << SET TO true TO ENABLE LOGGING TO FILE >>
$fv2_debug_log_file = '/tmp/folder_view2_php_debug.log';

function fv2_debug_log($message)
{
    if (FV2_DEBUG_MODE) {
        global $fv2_debug_log_file;
        $timestamp = date('Y-m-d H:i:s');
        if (is_array($message) || is_object($message)) {
            $message = json_encode($message);
        }
        @file_put_contents($fv2_debug_log_file, "[$timestamp] $message\n", FILE_APPEND);
    }
}

if (FV2_DEBUG_MODE && isset($_GET['type']) && basename($_SERVER['SCRIPT_NAME']) === 'read_info.php') {
    @file_put_contents($fv2_debug_log_file, "--- FolderView2 lib.php readInfo Start ---\n");
}

$folderVersion = 1.0;
$configDir = '/boot/config/plugins/folder.view2';
$sourceDir = '/usr/local/emhttp/plugins/folder.view2';
$documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';

require_once("$documentRoot/webGui/include/Helpers.php");
require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
require_once("$documentRoot/plugins/dynamix.vm.manager/include/libvirt_helpers.php");

function fv2_get_tailscale_ip_from_container(string $containerName): ?string
{
    if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
        fv2_debug_log("    fv2_get_tailscale_ip_from_container: Invalid container name for exec: $containerName");
        return null;
    }
    $command = 'docker exec ' . escapeshellarg($containerName) . ' tailscale ip -4 2>/dev/null';
    fv2_debug_log("    fv2_get_tailscale_ip_from_container: Executing: $command for $containerName");
    $output = [];
    $return_var = -1;
    @exec($command, $output, $return_var);

    if ($return_var === 0 && !empty($output) && filter_var(trim($output[0]), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $ip = trim($output[0]);
        fv2_debug_log("    fv2_get_tailscale_ip_from_container: Found IP for $containerName: $ip");
        return $ip;
    }
    fv2_debug_log("    fv2_get_tailscale_ip_from_container: No valid IP found for $containerName. Output: " . json_encode($output) . ", Return: $return_var");
    return null;
}

function fv2_get_tailscale_fqdn_from_container(string $containerName): ?string
{
    if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
        fv2_debug_log("    fv2_get_tailscale_fqdn_from_container: Invalid container name for exec: $containerName");
        return null;
    }
    $command = 'docker exec ' . escapeshellarg($containerName) . ' tailscale status --peers=false --json 2>/dev/null';
    fv2_debug_log("    fv2_get_tailscale_fqdn_from_container: Executing: $command for $containerName");
    $output_lines = [];
    $return_var = -1;
    @exec($command, $output_lines, $return_var);
    $json_output = implode("\n", $output_lines);

    if ($return_var === 0 && !empty($json_output)) {
        $status_data = json_decode($json_output, true);
        if (isset($status_data['Self']['DNSName'])) {
            $dnsName = rtrim($status_data['Self']['DNSName'], '.');
            fv2_debug_log("    fv2_get_tailscale_fqdn_from_container: Found DNSName for $containerName: " . $dnsName);
            return $dnsName;
        }
    }
    fv2_debug_log("    fv2_get_tailscale_fqdn_from_container: No DNSName found for $containerName. Output: " . $json_output . ", Return: $return_var");
    return null;
}

function readFolder(string $type): string
{
    global $configDir;
    if (!file_exists("$configDir/$type.json")) {
        createFile($type);
    }
    return file_get_contents("$configDir/$type.json");
}

function readUserPrefs(string $type): string
{
    $userPrefsDir = '/boot/config/plugins';
    $prefsFilePath = '';
    if ($type == 'docker') {
        $prefsFilePath = "$userPrefsDir/dockerMan/userprefs.cfg";
    } elseif ($type == 'vm') {
        $prefsFilePath = "$userPrefsDir/dynamix.vm.manager/userprefs.cfg";
    } else {
        return '[]';
    }
    if (!file_exists($prefsFilePath)) {
        return '[]';
    }
    $parsedIni = @parse_ini_file($prefsFilePath);
    return json_encode($parsedIni ?: []);
}

function updateFolder(string $type, string $content, string $id = ''): void
{
    global $configDir;
    if (!file_exists("$configDir/$type.json")) {
        createFile($type);
        if (empty($id)) {
            $id = generateId();
        }
    }
    if (empty($id)) {
        $id = generateId();
    }
    $fileData = json_decode(file_get_contents("$configDir/$type.json"), true) ?: [];
    $fileData[$id] = json_decode($content, true);
    file_put_contents("$configDir/$type.json", json_encode($fileData));
}

function deleteFolder(string $type, string $id): void
{
    global $configDir;
    if (!file_exists("$configDir/$type.json")) {
        createFile($type);
        return;
    }
    $fileData = json_decode(file_get_contents("$configDir/$type.json"), true) ?: [];
    unset($fileData[$id]);
    file_put_contents("$configDir/$type.json", json_encode($fileData));
}

function generateId(int $length = 20): string
{
    return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes((int)ceil($length * 3 / 4)))), 0, $length);
}

function createFile(string $type): void
{
    global $configDir;
    if (!is_dir($configDir)) {
        @mkdir($configDir, 0770, true);
    }
    $default = ['docker' => '{}', 'vm' => '{}'];
    @file_put_contents("$configDir/$type.json", $default[$type] ?? '{}');
}

function readInfo(string $type): array
{
    fv2_debug_log("readInfo called for type: $type");
    $info = [];
    if ($type == 'docker') {
        global $dockerManPaths, $documentRoot;
        global $driver, $host;
        if (!isset($driver) || !is_array($driver)) {
            $driver = DockerUtil::driver();
            fv2_debug_log('Initialized $driver: ' . json_encode($driver));
        }
        if (!isset($host)) {
            $host = DockerUtil::host();
            fv2_debug_log('Initialized $host: ' . $host);
        }

        $dockerClient = new DockerClient();
        $DockerUpdate = new DockerUpdate();
        $dockerTemplates = new DockerTemplates();

        $cts = $dockerClient->getDockerJSON('/containers/json?all=1');
        $autoStartFile = $dockerManPaths['autostart-file'] ?? '/var/lib/docker/unraid-autostart';
        $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
        $autoStart = array_map('var_split', $autoStartLines);

        $allXmlTemplates = [];
        foreach ($dockerTemplates->getTemplates('all') as $templateFile) {
            $doc = new DOMDocument();
            if (@$doc->load($templateFile['path'])) {
                $templateName = trim($doc->getElementsByTagName('Name')->item(0)->nodeValue ?? '');
                $templateImage = DockerUtil::ensureImageTag($doc->getElementsByTagName('Repository')->item(0)->nodeValue ?? '');
                if ($templateName && $templateImage) {
                    $allXmlTemplates[$templateName . '|' . $templateImage] = [
                        'WebUi' => trim($doc->getElementsByTagName('WebUI')->item(0)->nodeValue ?? ''),
                        'TSUrlRaw' => trim($doc->getElementsByTagName('TailscaleWebUI')->item(0)->nodeValue ?? ''),
                        'TSServeMode' => trim($doc->getElementsByTagName('TailscaleServe')->item(0)->nodeValue ?? 'no'),
                        'TSTailscaleEnabled' => strtolower(trim($doc->getElementsByTagName('TailscaleEnabled')->item(0)->nodeValue ?? 'false')) === 'true',
                        'Icon' => trim($doc->getElementsByTagName('Icon')->item(0)->nodeValue ?? ''),
                        'registry' => trim($doc->getElementsByTagName('Registry')->item(0)->nodeValue ?? ''),
                        'Support' => trim($doc->getElementsByTagName('Support')->item(0)->nodeValue ?? ''),
                        'Project' => trim($doc->getElementsByTagName('Project')->item(0)->nodeValue ?? ''),
                        'DonateLink' => trim($doc->getElementsByTagName('DonateLink')->item(0)->nodeValue ?? ''),
                        'ReadMe' => trim($doc->getElementsByTagName('ReadMe')->item(0)->nodeValue ?? ''),
                        'Shell' => trim($doc->getElementsByTagName('Shell')->item(0)->nodeValue ?? 'sh'),
                        'path' => $templateFile['path']
                    ];
                }
            }
        }
        unset($doc);
        // fv2_debug_log("Pre-parsed " . count($allXmlTemplates) . " XML templates.");

        foreach ($cts as $key => &$ct) {
            $ct['info'] = $dockerClient->getContainerDetails($ct['Id']);
            if (empty($ct['info'])) {
                fv2_debug_log('Skipped container due to empty details: ID ' . ($ct['Id'] ?? 'N/A'));
                continue;
            }

            $containerName = substr($ct['info']['Name'], 1);
            $ct['info']['Name'] = $containerName;
            fv2_debug_log("Processing Container: $containerName (ID: " . ($ct['Id'] ?? 'N/A') . ')');

            $ct['info']['State']['Autostart'] = in_array($containerName, $autoStart);
            $ct['info']['Config']['Image'] = DockerUtil::ensureImageTag($ct['info']['Config']['Image']);
            $ct['info']['State']['Updated'] = $DockerUpdate->getUpdateStatus($ct['info']['Config']['Image']);
            $ct['info']['State']['manager'] = $ct['Labels']['net.unraid.docker.managed'] ?? false;
            $ct['shortId'] = substr(str_replace('sha256:', '', $ct['Id']), 0, 12);
            $ct['shortImageId'] = substr(str_replace('sha256:', '', $ct['ImageID']), 0, 12);
            $ct['info']['State']['WebUi'] = '';
            $ct['info']['State']['TSWebUi'] = '';
            $ct['info']['Shell'] = 'sh';
            $ct['info']['template'] = null;
            $rawWebUiString = '';
            $rawTsXmlUrl = '';
            $tsServeModeFromXml = 'no';
            $isTailscaleEnabledForContainer = false;

            $templateKey = $containerName . '|' . $ct['info']['Config']['Image'];
            $templateData = $allXmlTemplates[$templateKey] ?? null;

            if ($ct['info']['State']['manager'] == 'dockerman' && !is_null($templateData)) {
                $rawWebUiString = $templateData['WebUi'];
                $rawTsXmlUrl = $templateData['TSUrlRaw'];
                $tsServeModeFromXml = $templateData['TSServeMode'];
                $isTailscaleEnabledForContainer = $templateData['TSTailscaleEnabled'];
                $ct['info']['registry'] = $templateData['registry'];
                $ct['info']['Support'] = $templateData['Support'];
                $ct['info']['Project'] = $templateData['Project'];
                $ct['info']['DonateLink'] = $templateData['DonateLink'];
                $ct['info']['ReadMe'] = $templateData['ReadMe'];
                $ct['info']['Shell'] = $templateData['Shell'] ?: 'sh';
                $ct['info']['template'] = ['path' => $templateData['path']];

                // Set icon from template data
                $ct['info']['Icon'] = $templateData['Icon'] ?: '';
            } else {
                $rawWebUiString = $ct['Labels']['net.unraid.docker.webui'] ?? '';
                $rawTsXmlUrl = $ct['Labels']['net.unraid.docker.tailscale.webui'] ?? '';
                $tsServeModeFromXml = $ct['Labels']['net.unraid.docker.tailscale.servemode'] ?? ($ct['Labels']['net.unraid.docker.tailscale.funnel'] === 'true' ? 'funnel' : 'no');
                $isTailscaleEnabledForContainer = strtolower($ct['Labels']['net.unraid.docker.tailscale.enabled'] ?? 'false') === 'true';
                $ct['info']['Shell'] = $ct['Labels']['net.unraid.docker.shell'] ?? 'sh';

                // Set icon from container labels (fallback for Docker-Compose containers)
                $ct['info']['Icon'] = $ct['Labels']['net.unraid.docker.icon'] ?? '';
            }

            // Additional fallback logic for icon handling
            if (empty($ct['info']['Icon'])) {
                // Try to extract icon from other common label formats
                $iconFallbacks = [
                    $ct['Labels']['org.opencontainers.image.icon'] ?? '',
                    $ct['Labels']['icon'] ?? '',
                    $ct['Labels']['docker.icon'] ?? ''
                ];

                foreach ($iconFallbacks as $fallbackIcon) {
                    if (!empty($fallbackIcon)) {
                        $ct['info']['Icon'] = $fallbackIcon;
                        fv2_debug_log("  $containerName: Using fallback icon: '$fallbackIcon'");
                        break;
                    }
                }

                // If still no icon, try to generate one from the image name
                if (empty($ct['info']['Icon'])) {
                    $imageName = $ct['info']['Config']['Image'] ?? '';
                    if (!empty($imageName)) {
                        // Extract base image name (remove registry and tag)
                        $baseImageName = preg_replace('/^[^/]+//', '', $imageName); // Remove registry
                        $baseImageName = preg_replace('/:.*$/', '', $baseImageName);   // Remove tag

                        // Try to construct a Docker Hub icon URL
                        if (!empty($baseImageName) && !strpos($baseImageName, '/')) {
                            // Official images
                            $ct['info']['Icon'] = "https://raw.githubusercontent.com/docker-library/docs/master/$baseImageName/logo.png";
                            fv2_debug_log("  $containerName: Generated Docker Hub icon for official image: '{$ct['info']['Icon']}'");
                        }
                    }
                }
            }
            fv2_debug_log("  $containerName: Using " . ($templateData && $ct['info']['State']['manager'] == 'dockerman' ? 'XML' : 'Label') . ' data. TailscaleEnabled: ' . ($isTailscaleEnabledForContainer ? 'true' : 'false'));
            fv2_debug_log("    $containerName: Raw WebUI: '$rawWebUiString', Raw TS XML URL: '$rawTsXmlUrl', TS Serve Mode: '$tsServeModeFromXml'");

            // --- Populate $ct['info']['Ports'] ---
            $ct['info']['Ports'] = [];
            $currentNetworkMode = $ct['HostConfig']['NetworkMode'] ?? 'unknown';
            $currentNetworkDriver = $driver[$currentNetworkMode] ?? null;

            $containerIpAddress = null;
            if ($currentNetworkMode !== 'host' && $currentNetworkDriver !== 'bridge') {
                $containerNetworkSettings = $ct['NetworkSettings']['Networks'][$currentNetworkMode] ?? null;
                if ($containerNetworkSettings && !empty($containerNetworkSettings['IPAddress'])) {
                    $containerIpAddress = $containerNetworkSettings['IPAddress'];
                }
            } elseif ($currentNetworkMode === 'host') {
                $containerIpAddress = $host;
            }
            fv2_debug_log("  $containerName: NetworkMode: $currentNetworkMode, Driver: " . ($currentNetworkDriver ?: 'N/A') . ', ContainerIP (for custom/host): ' . ($containerIpAddress ?: 'N/A'));
            fv2_debug_log("  $containerName: HostConfig.PortBindings: " . json_encode($ct['info']['HostConfig']['PortBindings'] ?? []));
            fv2_debug_log("  $containerName: Config.ExposedPorts: " . json_encode($ct['info']['Config']['ExposedPorts'] ?? []));

            if (isset($ct['info']['HostConfig']['PortBindings']) && is_array($ct['info']['HostConfig']['PortBindings']) && !empty($ct['info']['HostConfig']['PortBindings'])) {
                fv2_debug_log("  $containerName: Processing HostConfig.PortBindings...");
                foreach ($ct['info']['HostConfig']['PortBindings'] as $containerPortProtocol => $hostBindings) {
                    if (is_array($hostBindings) && !empty($hostBindings)) {
                        list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                        $protocol = strtoupper($protocol ?: 'TCP');
                        $hostBinding = $hostBindings[0];
                        $publicIp = ($hostBinding['HostIp'] === '0.0.0.0' || empty($hostBinding['HostIp'])) ? $host : $hostBinding['HostIp'];
                        $publicPort = $hostBinding['HostPort'] ?? null;

                        fv2_debug_log("    $containerName Binding: Private=$privatePort/$protocol, Public=$publicIp:" . ($publicPort ?: 'N/A'));
                        $ct['info']['Ports'][] = [
                            'PrivateIP' => null, // For bridge mappings, the "private IP" is internal to Docker, not usually the container's specific IP on another net
                            'PrivatePort' => $privatePort,
                            'PublicIP' => $publicIp,
                            'PublicPort' => $publicPort,
                            'NAT' => true,
                            'Type' => $protocol
                        ];
                    }
                }
            } elseif (isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts']) && !empty($ct['info']['Config']['ExposedPorts'])) {
                fv2_debug_log("  $containerName: Processing Config.ExposedPorts (Network: $currentNetworkMode)...");
                foreach ($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                    list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                    $protocol = strtoupper($protocol ?: 'TCP');

                    $effectiveIp = null;
                    $effectivePort = $privatePort;

                    if ($currentNetworkMode === 'host') {
                        $effectiveIp = $host;
                    } elseif (strpos($currentNetworkMode, 'container:') === 0) {
                        // Handle container: network mode by resolving target container's IP
                        $targetContainerName = substr($currentNetworkMode, 10); // Remove 'container:' prefix
                        fv2_debug_log("  $containerName: Port mapping for container network mode, target: '$targetContainerName'");

                        // Find the target container and get its network information
                        $targetContainerIp = null;
                        foreach ($cts as $targetCt) {
                            $targetName = substr($targetCt['info']['Name'] ?? '', 1); // Remove leading slash
                            if ($targetName === $targetContainerName) {
                                $targetNetworkMode = $targetCt['info']['HostConfig']['NetworkMode'] ?? 'unknown';
                                if ($targetNetworkMode === 'host') {
                                    $targetContainerIp = $host;
                                } else {
                                    $targetNetworkDriver = $driver[$targetNetworkMode] ?? null;
                                    if ($targetNetworkDriver !== 'bridge') {
                                        $targetNetworkSettings = $targetCt['info']['NetworkSettings']['Networks'][$targetNetworkMode] ?? null;
                                        if ($targetNetworkSettings && !empty($targetNetworkSettings['IPAddress'])) {
                                            $targetContainerIp = $targetNetworkSettings['IPAddress'];
                                        }
                                    } else {
                                        $targetContainerIp = $host; // Use host IP for bridge networks
                                    }
                                }
                                break;
                            }
                        }

                        if ($targetContainerIp) {
                            $effectiveIp = $targetContainerIp;
                            fv2_debug_log("  $containerName: Port mapping resolved target container IP: '$targetContainerIp'");
                        } else {
                            fv2_debug_log("  $containerName: Port mapping could not resolve target container '$targetContainerName' IP, using host IP");
                            $effectiveIp = $host;
                        }
                    } elseif ($currentNetworkMode !== 'none' && $containerIpAddress) {
                        $effectiveIp = $containerIpAddress;
                    }

                    fv2_debug_log("    $containerName Exposed: Private=$privatePort/$protocol, EffectiveIP=" . ($effectiveIp ?: 'null') . ", EffectivePort=$effectivePort");
                    $ct['info']['Ports'][] = [
                        'PrivateIP' => $containerIpAddress,
                        'PrivatePort' => $privatePort,
                        'PublicIP' => $effectiveIp,
                        'PublicPort' => $effectivePort,
                        'NAT' => false,
                        'Type' => $protocol
                    ];
                }
            } else {
                // Handle cases where containers don't have PortBindings or ExposedPorts
                // This is common for host network mode containers that don't explicitly define exposed ports
                if ($currentNetworkMode === 'host') {
                    fv2_debug_log("  $containerName: Host network mode with no explicit port bindings or exposed ports.");

                    // Try to extract port information from WebUI configuration
                    if (!empty($rawWebUiString) && preg_match('/\[PORT:(\d+)\]/', $rawWebUiString, $matches)) {
                        $extractedPort = $matches[1];
                        fv2_debug_log("  $containerName: Extracted port $extractedPort from WebUI configuration for host network mode.");

                        $ct['info']['Ports'][] = [
                            'PrivateIP' => $host,
                            'PrivatePort' => $extractedPort,
                            'PublicIP' => $host,
                            'PublicPort' => $extractedPort,
                            'NAT' => false,
                            'Type' => 'TCP'
                        ];
                    } elseif (!empty($rawWebUiString) && preg_match('/:([0-9]+)/', $rawWebUiString, $matches)) {
                        $extractedPort = $matches[1];
                        fv2_debug_log("  $containerName: Extracted port $extractedPort from WebUI URL for host network mode.");

                        $ct['info']['Ports'][] = [
                            'PrivateIP' => $host,
                            'PrivatePort' => $extractedPort,
                            'PublicIP' => $host,
                            'PublicPort' => $extractedPort,
                            'NAT' => false,
                            'Type' => 'TCP'
                        ];
                    }
                }
            }

            if ($currentNetworkMode === 'none') {
                fv2_debug_log("  $containerName: NetworkMode is 'none'. Adjusting public port aspects.");
                $tempPorts = [];
                if (isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts'])) {
                    foreach ($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                        list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                        $protocol = strtoupper($protocol ?: 'TCP');
                        $tempPorts[] = [
                            'PrivateIP' => null, // No specific container IP accessible
                            'PrivatePort' => $privatePort,
                            'PublicIP' => null,
                            'PublicPort' => null,
                            'NAT' => false,
                            'Type' => $protocol
                        ];
                    }
                }
                $ct['info']['Ports'] = $tempPorts;
            }
            ksort($ct['info']['Ports']);
            fv2_debug_log("  $containerName: Final ct[info][Ports]: " . json_encode($ct['info']['Ports']));

            $finalWebUi = '';
            if (!empty($rawWebUiString)) {
                if (strpos($rawWebUiString, '[IP]') === false && strpos($rawWebUiString, '[PORT:') === false) {
                    $finalWebUi = $rawWebUiString;
                } else {
                    $webUiIp = $host;
                    if ($currentNetworkMode === 'host') {
                        $webUiIp = $host;
                    } elseif ($currentNetworkDriver !== 'bridge' && $containerIpAddress) {
                        $webUiIp = $containerIpAddress;
                    }

                    // Handle container: network mode by resolving target container's network
                    if (strpos($currentNetworkMode, 'container:') === 0) {
                        $targetContainerName = substr($currentNetworkMode, 10); // Remove 'container:' prefix
                        fv2_debug_log("  $containerName: Using container network mode, target: '$targetContainerName'");

                        // Find the target container and get its network information
                        $targetContainerIp = null;
                        foreach ($cts as $targetCt) {
                            $targetName = substr($targetCt['info']['Name'] ?? '', 1); // Remove leading slash
                            if ($targetName === $targetContainerName) {
                                $targetNetworkMode = $targetCt['info']['HostConfig']['NetworkMode'] ?? 'unknown';
                                if ($targetNetworkMode === 'host') {
                                    $targetContainerIp = $host;
                                } else {
                                    $targetNetworkDriver = $driver[$targetNetworkMode] ?? null;
                                    if ($targetNetworkDriver !== 'bridge') {
                                        $targetNetworkSettings = $targetCt['info']['NetworkSettings']['Networks'][$targetNetworkMode] ?? null;
                                        if ($targetNetworkSettings && !empty($targetNetworkSettings['IPAddress'])) {
                                            $targetContainerIp = $targetNetworkSettings['IPAddress'];
                                        }
                                    } else {
                                        $targetContainerIp = $host; // Use host IP for bridge networks
                                    }
                                }
                                break;
                            }
                        }

                        if ($targetContainerIp) {
                            $webUiIp = $targetContainerIp;
                            fv2_debug_log("  $containerName: Resolved target container IP: '$targetContainerIp'");
                        } else {
                            fv2_debug_log("  $containerName: Could not resolve target container '$targetContainerName' IP, using host IP");
                            $webUiIp = $host;
                        }
                    } elseif ($currentNetworkMode === 'none') {
                        $finalWebUi = '';
                    }

                    if ($currentNetworkMode !== 'none') {
                        $tempWebUi = str_replace('[IP]', $webUiIp ?: '', $rawWebUiString);
                        if (preg_match("%\[PORT:(\d+)\]%", $tempWebUi, $matches)) {
                            $internalPortFromTemplate = $matches[1];
                            $mappedPublicPort = $internalPortFromTemplate;
                            foreach ($ct['info']['Ports'] as $p) {
                                if (isset($p['PrivatePort']) && $p['PrivatePort'] == $internalPortFromTemplate) {
                                    $isNatEquivalent = (($p['NAT'] ?? false) === true);
                                    $mappedPublicPort = ($isNatEquivalent && !empty($p['PublicPort'])) ? $p['PublicPort'] : $p['PrivatePort'];
                                    break;
                                }
                            }
                            $tempWebUi = preg_replace("%\[PORT:\d+\]%", $mappedPublicPort, $tempWebUi);
                        }
                        $finalWebUi = $tempWebUi;
                    }
                }
            }
            $ct['info']['State']['WebUi'] = $finalWebUi;
            fv2_debug_log("  $containerName: Resolved Standard WebUi: '$finalWebUi'");

            $finalTsWebUi = '';
            if ($isTailscaleEnabledForContainer) {
                fv2_debug_log("  $containerName: Tailscale is ENABLED. Attempting to resolve TS WebUI.");
                $baseTsTemplateFromHelper = '';
                if (!empty($rawTsXmlUrl)) {
                    $baseTsTemplateFromHelper = generateTSwebui($rawTsXmlUrl, $tsServeModeFromXml, $rawWebUiString);
                } elseif (!empty($ct['Labels']['net.unraid.docker.tailscale.webui'])) {
                    $baseTsTemplateFromHelper = $ct['Labels']['net.unraid.docker.tailscale.webui'];
                }
                fv2_debug_log("    $containerName: Base TS WebUI from generateTSwebui/label: '$baseTsTemplateFromHelper'");

                if (!empty($baseTsTemplateFromHelper)) {
                    if (strpos($baseTsTemplateFromHelper, '[hostname]') !== false || strpos($baseTsTemplateFromHelper, '[HOSTNAME]') !== false) {
                        $tsFqdn = fv2_get_tailscale_fqdn_from_container($containerName);
                        if ($tsFqdn) {
                            $finalTsWebUi = str_replace(['[hostname][magicdns]', '[HOSTNAME][MAGICDNS]'], $tsFqdn, $baseTsTemplateFromHelper);
                            if (strpos($baseTsTemplateFromHelper, 'http://[hostname]') === 0) {
                                $finalTsWebUi = str_replace('http://', 'https://', $finalTsWebUi);
                            }
                        } else {
                            fv2_debug_log("    $containerName: TS WebUI: Could not resolve [hostname] via exec.");
                            $finalTsWebUi = '';
                        }
                    } elseif (strpos($baseTsTemplateFromHelper, '[noserve]') !== false || strpos($baseTsTemplateFromHelper, '[NOSERVE]') !== false) {
                        $tsIP = fv2_get_tailscale_ip_from_container($containerName);
                        if ($tsIP) {
                            $finalTsWebUi = str_replace(['[noserve]', '[NOSERVE]'], $tsIP, $baseTsTemplateFromHelper);
                            $internalPortForTS = null;
                            if (preg_match('/\[PORT:(\d+)\]/i', $baseTsTemplateFromHelper, $portMatches)) {
                                $internalPortForTS = $portMatches[1];
                            } elseif (preg_match('/\[PORT:(\d+)\]/i', $rawWebUiString, $portMatches)) {
                                $internalPortForTS = $portMatches[1];
                            } elseif (preg_match('/:(\d+)/', $finalTsWebUi, $portMatchesNoserve)) {
                                $internalPortForTS = $portMatchesNoserve[1];
                            }

                            if ($internalPortForTS !== null) {
                                $finalTsWebUi = preg_replace('/\[PORT:\d+\]/i', $internalPortForTS, $finalTsWebUi);
                                if (strpos($baseTsTemplateFromHelper, '[noserve]:[PORT:') === false && preg_match('/:(\d+)/', $baseTsTemplateFromHelper, $portMatchesRawBase)) {
                                    if ($portMatchesRawBase[1] != $internalPortForTS) {
                                        $finalTsWebUi = str_replace(":$portMatchesRawBase[1]", ":$internalPortForTS", $finalTsWebUi);
                                    }
                                }
                            }
                        } else {
                            fv2_debug_log("    $containerName: TS WebUI: Could not resolve [noserve] via exec.");
                            $finalTsWebUi = '';
                        }
                    } else {
                        $finalTsWebUi = $baseTsTemplateFromHelper;
                    }
                }
            } else {
                fv2_debug_log("  $containerName: Tailscale is NOT enabled or no TS URL defined in template/label.");
            }
            $ct['info']['State']['TSWebUi'] = $finalTsWebUi;
            fv2_debug_log("  $containerName: Resolved TS WebUi: '$finalTsWebUi'");

            $info[$containerName] = $ct;
        }
        unset($ct);

    } elseif ($type == 'vm') {
        global $lv;
        if (!isset($lv)) {
            $lv = new Libvirt();
            if (!$lv->connect()) {
                fv2_debug_log('VM: Libvirt connection failed.');
                return [];
            }
        }
        $vms = $lv->get_domains();
        fv2_debug_log('VM: Found ' . count($vms) . ' VMs.');
        if (!empty($vms)) {
            foreach ($vms as $vm) {
                $res = $lv->get_domain_by_name($vm);
                if (!$res) {
                    fv2_debug_log("VM: Could not get domain by name for $vm.");
                    continue;
                }
                $dom = $lv->domain_get_info($res);
                $info[$vm] = [
                    'uuid' => $lv->domain_get_uuid($res), 'name' => $vm,
                    'description' => $lv->domain_get_description($res),
                    'autostart' => $lv->domain_get_autostart($res),
                    'state' => $lv->domain_state_translate($dom['state']),
                    'icon' => $lv->domain_get_icon_url($res),
                    'logs' => (is_file("/var/log/libvirt/qemu/$vm.log") ? "libvirt/qemu/$vm.log" : '')
                ];
            }
        }
    }
    fv2_debug_log("readInfo for type: $type completed.");
    return $info;
}

function readUnraidOrder(string $type): array
{
    fv2_debug_log("readUnraidOrder called for type: $type");
    $user_prefs_path = '/boot/config/plugins';
    $order = [];
    if ($type == 'docker') {
        $dockerClient = new DockerClient();
        $containersFromUnraid = $dockerClient->getDockerContainers();
        $prefs_file = "$user_prefs_path/dockerMan/userprefs.cfg";

        if (file_exists($prefs_file)) {
            $prefs_ini = @parse_ini_file($prefs_file);
            if ($prefs_ini) {
                $prefs_array = array_values($prefs_ini);
                $sort = [];
                $count_containers = count($containersFromUnraid);
                foreach ($containersFromUnraid as $ct_item) {
                    $search = array_search($ct_item['Name'], $prefs_array);
                    $sort[] = ($search === false) ? ($count_containers + count($sort) + 1) : $search;
                }
                if (!empty($sort)) {
                    @array_multisort($sort, SORT_NUMERIC, $containersFromUnraid);
                } else {
                    @usort($containersFromUnraid, function ($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
                }
            } else {
                @usort($containersFromUnraid, function ($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
            }
        } else {
            @usort($containersFromUnraid, function ($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
        }
        $order = array_column($containersFromUnraid, 'Name');

    } elseif ($type == 'vm') {
        global $lv;
        if (!isset($lv)) {
            $lv = new Libvirt();
            if (!$lv->connect()) {
                fv2_debug_log('VM Order: Libvirt connection failed.');
                return [];
            }
        }

        $prefs_file = "$user_prefs_path/dynamix.vm.manager/userprefs.cfg";
        $vms = $lv->get_domains();

        if (!empty($vms)) {
            if (file_exists($prefs_file)) {
                $prefs_ini = @parse_ini_file($prefs_file);
                if ($prefs_ini) {
                    $prefs_array = array_values($prefs_ini);
                    $sort = [];
                    $count_vms = count($vms);
                    foreach ($vms as $vm_name) {
                        $search = array_search($vm_name, $prefs_array);
                        $sort[] = ($search === false) ? ($count_vms + count($sort) + 1) : $search;
                    }
                    if (!empty($sort)) {
                        @array_multisort($sort, SORT_NUMERIC, $vms);
                    } else {
                        natcasesort($vms);
                    }
                } else {
                    natcasesort($vms);
                }
            } else {
                natcasesort($vms);
            }
            $order = array_values($vms);
        }
    }
    fv2_debug_log("readUnraidOrder for type: $type completed. Order: " . json_encode($order));
    return $order;
}
function pathToMultiDimArray($dir)
{
    $final = [];
    try {
        if (!is_dir($dir) || !is_readable($dir)) {
            return $final;
        }
        $elements = array_diff(scandir($dir), ['.', '..']);
        foreach ($elements as $el) {
            $newEl = "{$dir}/{$el}";
            if (is_dir($newEl)) {
                array_push($final, ['name' => $el, 'path' => $newEl, 'sub' => pathToMultiDimArray($newEl)]);
            } elseif (is_file($newEl)) {
                array_push($final, ['name' => $el, 'path' => $newEl]);
            }
        }
    } catch (Throwable $err) {
        fv2_debug_log("Error in pathToMultiDimArray for $dir: " . $err->getMessage());
    }
    return $final;
}
function dirToArrayOfFiles($dir, $fileFilter = null, $folderFilter = null)
{
    $final = [];
    if (!is_array($dir)) {
        return $final;
    }
    foreach ($dir as $el) {
        if (!is_array($el) || !isset($el['name'])) {
            continue;
        }
        if (isset($el['sub']) && (!isset($folderFilter) || (isset($folderFilter) && !preg_match($folderFilter, $el['name'])))) {
            $final = array_merge($final, dirToArrayOfFiles($el['sub'], $fileFilter, $folderFilter));
        } elseif (!isset($el['sub']) && (!isset($fileFilter) || (isset($fileFilter) && preg_match($fileFilter, $el['name'])))) {
            array_push($final, $el);
        }
    }
    return $final;
}
