/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    // ########################################
    // ##########       DOCKER       ##########
    // ########################################

    // if docker is enabled
    if($('tbody#docker_view').length > 0) {

        let prom = await Promise.all(folderReq.docker);
        // Parse the results
        let folders = JSON.parse(prom[0]);
        const unraidOrder = JSON.parse(prom[1]);
        const containersInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
    
        // Filter the order to get the container that aren't in the order, this happen when a new container is created
        let newOnes = order.filter(x => !unraidOrder.includes(x));

        // Insert the folder in the unraid folder into the order shifted by the unlisted containers
        for (let index = 0; index < unraidOrder.length; index++) {
            const element = unraidOrder[index];
            if((folderRegex.test(element) && folders[element.slice(7)])) {
                order.splice(index+newOnes.length, 0, element);
            }
        }

        // debug mode, download the debug json file
        if(folderDebugMode) {
            let element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
                version: (await $.get('/plugins/folder.view2/server/version.php').promise()).trim(),
                folders,
                unraidOrder,
                originalOrder: JSON.parse(await $.get('/plugins/folder.view2/server/read_unraid_order.php?type=docker').promise()),
                newOnes,
                order,
                containersInfo
            })));
            element.setAttribute('download', 'debug-DASHBOARD-DOCKER.json');
        
            element.style.display = 'none';
            document.body.appendChild(element);
        
            element.click();
        
            document.body.removeChild(element);
            console.log('Docker Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    key -= createFolderDocker(folders[id], id, key, order, containersInfo, Object.keys(foldersDone));
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        for (const [id, value] of Object.entries(folders)) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            createFolderDocker(value, id, 0, order, containersInfo, Object.keys(foldersDone));
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            delete folders[id];
        }
    
        // if started only is active hide all stopped folder
        if ($('input#apps').is(':checked')) {
            $('tbody#docker_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        
    
        // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
        for (const [id, value] of Object.entries(foldersDone)) {
            if ((globalFolders.docker && globalFolders.docker[id].status.expanded) || value.settings.expand_dashboard) {
                value.status.expanded = true;
                expandFolderDocker(id);
            }
        }

        const $ungroupedDockerContainers = $('tbody#docker_view > tr.updated > td > span.outer.apps').not('.folder-element-docker');
        if ($ungroupedDockerContainers.length > 0) {
            $ungroupedDockerContainers.show();
        }
        
        folderEvents.dispatchEvent(new CustomEvent('docker-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));
    
        // Assing the folder done to the global object
        globalFolders.docker = foldersDone;

    }


    // ########################################
    // ##########         VMS        ##########
    // ########################################

    // if vm is enabled
    if($('tbody#vm_view').length > 0) {

        const prom = await Promise.all(folderReq.vm);
        // Parse the results
        let folders = JSON.parse(prom[0]);
        const unraidOrder = Object.values(JSON.parse(prom[1]));
        const vmInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
    
        // Filter the webui order to get the container that aren't in the order, this happen when a new container is created
        let newOnes = order.filter(x => !unraidOrder.includes(x));

        // Insert the folder in the unraid folder into the order shifted by the unlisted containers
        for (let index = 0; index < unraidOrder.length; index++) {
            const element = unraidOrder[index];
            if((folderRegex.test(element) && folders[element.slice(7)])) {
                order.splice(index+newOnes.length, 0, element);
            }
        }

        // debug mode, download the debug json file
        if(folderDebugMode) {
            let element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
                version: (await $.get('/plugins/folder.view2/server/version.php').promise()).trim(),
                folders,
                unraidOrder,
                originalOrder: JSON.parse(await $.get('/plugins/folder.view2/server/read_unraid_order.php?type=vm').promise()),
                newOnes,
                order,
                vmInfo
            })));
            element.setAttribute('download', 'debug-DASHBOARD-VM.json');
        
            element.style.display = 'none';
            document.body.appendChild(element);
        
            element.click();
        
            document.body.removeChild(element);
            console.log('VM Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    key -= createFolderVM(folders[id], id, key, order, vmInfo, Object.keys(foldersDone));
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        for (const [id, value] of Object.entries(folders)) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            createFolderVM(value, id, 0, order, vmInfo, Object.keys(foldersDone));
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            delete folders[id];
        }

        // if started only is active hide all stopped folder
        if ($('input#vms').is(':checked')) {
            $('tbody#vm_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
        for (const [id, value] of Object.entries(foldersDone)) {
            if ((globalFolders.vms && globalFolders.vms[id].status.expanded) || value.settings.expand_dashboard) {
                value.status.expanded = true;
                expandFolderVM(id);
            }
        }

        const $ungroupedVMContainers = $('tbody#vm_view > tr.updated > td > span.outer.vms').not('.folder-element-vm');
        if ($ungroupedVMContainers.length > 0) {
            $ungroupedVMContainers.show();
        }
        
        const $ungroupedDockerContainers = $('tbody#docker_view > tr.updated > td > span.outer.apps').not('.folder-element-docker');
        
        if ($ungroupedDockerContainers.length > 0) {
            const dockerUngroupedContainer = $('<div class="ungrouped-sections-container"></div>');
            const dockerSection = $('<div class="ungrouped-section"></div>');
            const dockerHeader = $('<h3>Ungrouped Docker Containers</h3>');
            const dockerContainers = $('<div class="ungrouped-containers"></div>');
            
            dockerContainers.append($ungroupedDockerContainers.detach());
            dockerSection.append(dockerHeader).append(dockerContainers);
            dockerUngroupedContainer.append(dockerSection);
            
            $('tbody#docker_view > tr.updated > td').append(dockerUngroupedContainer);
        }
        
        if ($ungroupedVMContainers.length > 0) {
            const vmUngroupedContainer = $('<div class="ungrouped-sections-container"></div>');
            const vmSection = $('<div class="ungrouped-section"></div>');
            const vmHeader = $('<h3>Ungrouped Virtual Machines</h3>');
            const vmContainers = $('<div class="ungrouped-containers"></div>');
            
            vmContainers.append($ungroupedVMContainers.detach());
            vmSection.append(vmHeader).append(vmContainers);
            vmUngroupedContainer.append(vmSection);
            
            $('tbody#vm_view > tr.updated > td').append(vmUngroupedContainer);
        }
        
        folderEvents.dispatchEvent(new CustomEvent('vm-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));

        globalFolders.vms = foldersDone;
    }

    // folderDebugMode  = false; // Keep disabled
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of containers
 * @param {object} containersInfo info of the containers
 * @param {Array<string>} foldersDone folders that are done
 * @returns the number of element removed before the folder
 */
const createFolderDocker = (folder, id, position, order, containersInfo, foldersDone) => {

    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let upToDate = true;
    let started = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    let remBefore = 0;

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    folder.containers = folder.containers.concat(order.filter(el => containersInfo[el]?.Labels['folder.view2'] === folder.name));

    // the HTML template for the folder with preview area
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer">
        <span class="outer solid apps stopped folder-docker">
            <span id="folder-id-${id}" onclick='addDockerFolderContext("${id}")' class="hand docker folder-hand-docker">
                <img src="${folder.icon}" class="img folder-img-docker" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">
            </span>
            <span class="inner folder-inner-docker">
                <span class="folder-appname-docker">${folder.name}</span><br>
                <i class="fa fa-square stopped red-text folder-load-status-docker"></i>
                <span class="state folder-state-docker">${$.i18n('stopped')}</span>
            </span>
            <div class="folder-storage"></div>
        </span>
        <div class="folder-content-container">
            <div class="folder-preview-area" id="folder-preview-${id}"></div>
            <div class="folder-showcase-${id} folder-showcase"></div>
        </div>
    </div>`;

    // insertion at position of the folder
    if (position === 0) {
        $('tbody#docker_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#docker_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of folder.containers) {
        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            containersInfo: containersInfo,
            foldersDone: foldersDone,
            container: container,
            ct: containersInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);
            const ct = containersInfo[container];

            let $dockerElement = null;
            
            // Debug: Let's see what the actual DOM structure looks like
            if(folderDebugMode) {
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): === DOM STRUCTURE ANALYSIS START ===`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): Looking for container '${container}'`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): tbody#docker_view exists: ${$('tbody#docker_view').length > 0}`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): tr.updated exists: ${$('tbody#docker_view > tr.updated').length}`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): td elements: ${$('tbody#docker_view > tr.updated > td').length}`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): .outer.apps elements: ${$('tbody#docker_view > tr.updated > td').children('.outer.apps').length}`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): .outer elements: ${$('tbody#docker_view > tr.updated > td').children('.outer').length}`);
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): All children: ${$('tbody#docker_view > tr.updated > td').children().length}`);
                
                // Let's see what classes and text the children actually have
                $('tbody#docker_view > tr.updated > td').children().each(function(index) {
                    const $this = $(this);
                    const classes = $this.attr('class') || 'no-class';
                    const text = $this.text().trim().substring(0, 100);
                    const tagName = $this.prop('tagName');
                    console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): Child[${index}] <${tagName}> classes='${classes}' text='${text}'`);
                    
                    // Look for container names in different locations
                    const appname = $this.find('.appname').text().trim();
                    const inner = $this.find('.inner').text().trim();
                    if(appname) console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): Child[${index}] .appname='${appname}'`);
                    if(inner) console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): Child[${index}] .inner='${inner.substring(0, 50)}'`);
                });
                console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): === DOM STRUCTURE ANALYSIS END ===`);
            }
            
            // Search through all Docker elements in the dashboard to find the one matching this container name
            $('tbody#docker_view > tr.updated > td').children('.outer.apps').each(function() {
                const $this = $(this);
                // Extract container name from .inner text by removing status suffixes
                const innerText = $this.find('.inner').first().text().trim();
                let containerNameElement = '';
                
                // Remove common status suffixes to get the actual container name
                if (innerText.endsWith('started')) {
                    containerNameElement = innerText.replace(/started$/, '');
                } else if (innerText.endsWith('stopped')) {
                    containerNameElement = innerText.replace(/stopped$/, '');
                } else {
                    containerNameElement = innerText;
                }
                
                if(folderDebugMode) {
                    console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): Extracted container name '${containerNameElement}' from inner text '${innerText}' - comparing against target '${container}'`);
                }
                
                if (containerNameElement === container) {
                    $dockerElement = $this;
                    if(folderDebugMode) {
                        console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}): MATCH FOUND for container '${container}'`);
                    }
                    return false; // Break the loop
                }
            });
            
            // grab the storage folder
            const element = $(`tbody#docker_view span#folder-id-${id}`).siblings('div.folder-storage');
            
            if ($dockerElement && $dockerElement.length) {
                if(folderDebugMode) {
                    console.log(`[FV2_DEBUG] Docker createFolder (id: ${id}), container ${container}: Found Docker element, moving to folder storage.`);
                }
                // Move the Docker element to folder storage
                element.append(
                    $dockerElement.addClass(`folder-${id}-element`).addClass(`folder-element-docker`).addClass(`${!(ct.info.State.Autostart === false) ? 'autostart' : ''}`)
                );
                
                // Add to preview area (show first 3 containers)
                const previewArea = $(`#folder-preview-${id}`);
                const currentPreviews = previewArea.children('.folder-container-preview').length;
                
                if (currentPreviews < 3) {
                    // Clone the container for preview
                    const $previewElement = $dockerElement.clone()
                        .removeClass(`folder-${id}-element folder-element-docker`)
                        .addClass('folder-container-preview')
                        .attr('id', `preview-${$dockerElement.attr('id') || container}-preview`);
                    previewArea.append($previewElement);
                }
            } else {
                if(folderDebugMode) {
                    console.warn(`[FV2_DEBUG] Docker createFolder (id: ${id}), container ${container}: Docker element not found in DOM! Using fallback index method.`);
                }
                // Fallback to original index method if name-based selection fails
                element.append($('tbody#docker_view > tr.updated > td').children().eq(index).addClass(`folder-${id}-element`).addClass(`folder-element-docker`).addClass(`${!(ct.info.State.Autostart === false) ? 'autostart' : ''}`));
            }
            

            newFolder[container] = {};
            newFolder[container].id = ct.shortId;
            newFolder[container].pause = ct.info.State.Paused;
            newFolder[container].state = ct.info.State.Running;
            newFolder[container].update = ct.info.State.Updated === false;
            newFolder[container].managed = ct.info.State.manager === 'dockerman';

            if(folderDebugMode) {
                console.log(`Docker ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }

            // set the status of the folder
            upToDate = upToDate && !newFolder[container].update;
            started += newFolder[container].state ? 1 : 0;
            autostart += !(ct.info.State.Autostart === false) ? 1 : 0;
            autostartStarted += ((!(ct.info.State.Autostart === false)) && newFolder[container].state) ? 1 : 0;
            managed += newFolder[container].managed ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                containersInfo: containersInfo,
                foldersDone: foldersDone,
                container: container,
                ct: containersInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    upToDate,
                    started,
                    autostart,
                    autostartStarted,
                    managed
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    //temp var
    const sel = $(`tbody#docker_view span#folder-id-${id}`)
    
    //set tehe status of a folder

    if (!upToDate) {
        sel.next('span.inner').children().first().addClass('blue-text');
    }

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    if(managed === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-managed');
    } else if (managed > 0 && managed < Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-partial');
    } else if (managed > 0 && managed === Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-full');
    }

    // Restore Docker folder expansion state from localStorage
    let savedExpanded = false;
    try {
        const folderStates = JSON.parse(localStorage.getItem('folderView2_dockerStates') || '{}');
        savedExpanded = folderStates[id] === true;
        console.log(`[FV2_DEBUG] createFolderDocker (id: ${id}): Restored expanded state from localStorage: ${savedExpanded}`);
    } catch (e) {
        console.warn(`[FV2_DEBUG] createFolderDocker (id: ${id}): Failed to restore state from localStorage:`, e);
    }

    // set the status
    folder.status = {};
    folder.status.upToDate = upToDate;
    folder.status.started = started;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.managed = managed;
    folder.status.expanded = savedExpanded;

    // Add "+" indicator only if there are MORE than 3 containers in the folder
    const totalContainers = Object.keys(folder.containers).length;
    const previewArea = $(`#folder-preview-${id}`);
    
    // Always clean up any existing indicators first
    previewArea.find('.folder-more-indicator').remove();
    
    // Only add + indicator if there are MORE than 3 containers
    if (totalContainers > 3) {
        const moreIndicator = $('<span class="folder-more-indicator" onclick="expandFolderDocker(\'' + id + '\')" title="Click to expand folder">+</span>');
        previewArea.append(moreIndicator);
        console.log(`[FV2] Docker folder ${id}: ${totalContainers} containers, showing + indicator`);
    } else {
        console.log(`[FV2] Docker folder ${id}: ${totalContainers} containers, no + indicator needed`);
    }
    
    // Auto-expand Docker folder if it was previously expanded
    if (savedExpanded) {
        setTimeout(() => {
            console.log(`[FV2_DEBUG] createFolderDocker (id: ${id}): Auto-expanding Docker folder based on saved state.`);
            expandFolderDocker(id);
        }, 100); // Small delay to ensure DOM is ready
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of vms
 * @param {object} vmInfo info of the vms
 * @param {Array<string>} foldersDone folders that are done
 * @returns the number of element removed before the folder
 */
const createFolderVM = (folder, id, position, order, vmInfo, foldersDone) => {

    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let started = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let remBefore = 0;

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    // the HTML template for the folder with preview area
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer">
        <span class="outer solid vms stopped folder-vm">
            <span id="folder-id-${id}" onclick='addVMFolderContext("${id}")' class="hand vm folder-hand-vm">
                <img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'>
            </span>
            <span class="inner folder-inner-vm">${folder.name}<br>
                <i class="fa fa-square stopped red-text folder-load-status-vm"></i>
                <span class="state folder-state-vm">${$.i18n('stopped')}</span>
            </span>
            <div class="folder-storage"></div>
        </span>
        <div class="folder-content-container">
            <div class="folder-preview-area" id="folder-preview-${id}"></div>
            <div class="folder-showcase-${id} folder-showcase"></div>
        </div>
    </div>`;

    // insertion at position of the folder
    if (position === 0) {
        $('tbody#vm_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#vm_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of folder.containers) {
        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            vmInfo: vmInfo,
            foldersDone: foldersDone,
            vm: container,
            ct: vmInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {
            if(folderDebugMode) {
                console.log(`[FV2_DEBUG] VM createFolder (id: ${id}), container ${container}: Processing - index=${index}, offsetIndex=${offsetIndex}, position=${position}`);
            }

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);

            // add the id to the container name 
            const ct = vmInfo[container];
            newFolder[container] = {};
            newFolder[container].id = ct.uuid;
            newFolder[container].state = ct.state;

            // Find the correct VM element by name in the dashboard structure
            let $vmElement = null;
            
            // Search through all VM elements in the dashboard to find the one matching this container name
            $('tbody#vm_view > tr.updated > td').children('.outer.vms').each(function() {
                const $this = $(this);
                const vmInnerText = $this.find('.inner').first().text().trim();
                // Extract VM name by removing status suffixes (similar to Docker logic)
                const vmNameElement = vmInnerText.replace(/started$|stopped$|paused$/i, '').trim();
                
                if(folderDebugMode) {
                    console.log(`[FV2_DEBUG] VM createFolder (id: ${id}), container ${container}: Checking VM element - inner text='${vmInnerText}', extracted name='${vmNameElement}', comparing against target '${container}'`);
                }
                
                if (vmNameElement === container) {
                    $vmElement = $this;
                    return false; // Break the loop
                }
            });
            
            if ($vmElement && $vmElement.length) {
                if(folderDebugMode) {
                    console.log(`[FV2_DEBUG] VM createFolder (id: ${id}), container ${container}: Found VM element, moving to folder storage.`);
                }
                
                // Add to preview area FIRST (show first 3 VMs) - clone before moving to storage
                const previewArea = $(`#folder-preview-${id}`);
                const currentPreviews = previewArea.children('.folder-container-preview').length;
                
                if (currentPreviews < 3) {
                    // Clone the VM for preview BEFORE moving original to storage
                    const $previewElement = $vmElement.clone()
                        .addClass('folder-container-preview')
                        .attr('id', `preview-${$vmElement.attr('id') || container}-preview`);
                    previewArea.append($previewElement);
                    
                    if(folderDebugMode) {
                        console.log(`[FV2_DEBUG] VM createFolder (id: ${id}), container ${container}: Added VM to preview area (${currentPreviews + 1}/3).`);
                    }
                }
                
                // Now move the original VM element to folder storage (hidden)
                $(`tbody#vm_view span#folder-id-${id}`).siblings('div.folder-storage').append(
                    $vmElement.addClass(`folder-${id}-element`).addClass(`folder-element-vm`).addClass(`${ct.autostart ? 'autostart' : ''}`)
                );
                
                // Check if we need to add/update the "+" indicator after processing all VMs
                // This will be handled in the folder completion logic
            } else {
                if(folderDebugMode) {
                    console.warn(`[FV2_DEBUG] VM createFolder (id: ${id}), container ${container}: VM element not found in DOM! Using fallback index method.`);
                }
                // Fallback to original index method if name-based selection fails
                $(`tbody#vm_view span#folder-id-${id}`).siblings('div.folder-storage').append($('tbody#vm_view > tr.updated > td').children().eq(index).addClass(`folder-${id}-element`).addClass(`folder-element-vm`).addClass(`${ct.autostart ? 'autostart' : ''}`));
            }

            if(folderDebugMode) {
                console.log(`VM ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            // set the status of the folder
            started += ct.state!=="shutoff" ? 1 : 0;
            autostart += ct.autostart ? 1 : 0;
            autostartStarted += (ct.autostart && ct.state!=="shutoff") ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                vmInfo: vmInfo,
                foldersDone: foldersDone,
                vm: container,
                ct: vmInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    started,
                    autostart,
                    autostartStarted
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    
    //set tehe status of a folder
    if (started) {
        const sel = $(`tbody#vm_view span#folder-id-${id}`);
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    // Restore VM folder expansion state from localStorage
    let savedExpanded = false;
    try {
        const folderStates = JSON.parse(localStorage.getItem('folderView2_vmStates') || '{}');
        savedExpanded = folderStates[id] === true;
        console.log(`[FV2_DEBUG] createFolderVM (id: ${id}): Restored expanded state from localStorage: ${savedExpanded}`);
    } catch (e) {
        console.warn(`[FV2_DEBUG] createFolderVM (id: ${id}): Failed to restore state from localStorage:`, e);
    }

    // Add "+" indicator only if there are MORE than 3 VMs in the folder
    const totalVMs = Object.keys(folder.containers).length;
    const previewArea = $(`#folder-preview-${id}`);
    
    // Always clean up any existing indicators first
    previewArea.find('.folder-more-indicator').remove();
    
    // Only add + indicator if there are MORE than 3 VMs
    if (totalVMs > 3) {
        const moreIndicator = $('<span class="folder-more-indicator" onclick="expandFolderVM(\'' + id + '\')" title="Click to expand folder">+</span>');
        previewArea.append(moreIndicator);
        console.log(`[FV2] VM folder ${id}: ${totalVMs} VMs, showing + indicator`);
    } else {
        console.log(`[FV2] VM folder ${id}: ${totalVMs} VMs, no + indicator needed`);
    }
    
    // set the status
    folder.status = {};
    folder.status.started = started;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.expanded = savedExpanded;
    
    // Auto-expand VM folder if it was previously expanded
    if (savedExpanded) {
        setTimeout(() => {
            console.log(`[FV2_DEBUG] createFolderVM (id: ${id}): Auto-expanding VM folder based on saved state.`);
            expandFolderVM(id);
        }, 100); // Small delay to ensure DOM is ready
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const expandFolderDocker = (id) => {
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-expansion', {detail: { id }}));
    const $folderOuter = $(`.folder-showcase-outer-${id}`);
    const $folderShowcase = $(`.folder-showcase-${id}`);
    const $folderStorage = $(`span#folder-id-${id}`).siblings('div.folder-storage');
    const state = $folderOuter.attr('expanded') === "true";
    
    if(folderDebugMode) {
        console.log(`[FV2_DEBUG] expandFolderDocker (id: ${id}): Current state=${state}, toggling to ${!state}`);
    }
    
    if (state) {
        // Collapsing: Move containers back to storage and hide showcase
        $folderStorage.append($folderShowcase.children());
        $folderOuter.attr('expanded', 'false');
        $(`span#folder-id-${id}`).attr('expanded', 'false');
        
        // Change indicator back to "+" and move to preview area
        const $previewArea = $(`#folder-preview-${id}`);
        const $contractIndicator = $folderShowcase.find('.folder-contract-indicator');
        if ($contractIndicator.length) {
            $contractIndicator.remove();
        }
        // Restore "+" indicator only if there are MORE than 3 containers (not exactly 3)
        if ($folderStorage.children().length > 3 && !$previewArea.find('.folder-more-indicator').length) {
            const moreIndicator = $('<span class="folder-more-indicator" onclick="expandFolderDocker(\'' + id + '\')" title="Click to expand folder">+</span>');
            $previewArea.append(moreIndicator);
        }
    } else {
        // Expanding: Move all containers from storage to showcase
        $folderShowcase.append($folderStorage.children());
        $folderOuter.attr('expanded', 'true');
        $(`span#folder-id-${id}`).attr('expanded', 'true');
        
        // Add "-" indicator to contract in the showcase area
        if (!$folderShowcase.find('.folder-contract-indicator').length) {
            const contractIndicator = $('<span class="folder-contract-indicator folder-more-indicator" onclick="expandFolderDocker(\'' + id + '\')" title="Click to contract folder">-</span>');
            $folderShowcase.append(contractIndicator);
        }
        
        // Remove "+" indicator from preview area
        $(`#folder-preview-${id} .folder-more-indicator`).remove();
    }
    
    if(globalFolders.docker) {
        globalFolders.docker[id].status.expanded = !state;
        
        // Persist Docker folder expansion state to localStorage
        try {
            const folderStates = JSON.parse(localStorage.getItem('folderView2_dockerStates') || '{}');
            folderStates[id] = !state;
            localStorage.setItem('folderView2_dockerStates', JSON.stringify(folderStates));
            console.log(`[FV2_DEBUG] expandFolderDocker (id: ${id}): Persisted expanded state ${!state} to localStorage.`);
        } catch (e) {
            console.warn(`[FV2_DEBUG] expandFolderDocker (id: ${id}): Failed to persist state to localStorage:`, e);
        }
    }
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-expansion', {detail: { id }}));
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const expandFolderVM = (id) => {
    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-expansion', {detail: { id }}));
    const $folderOuter = $(`.folder-showcase-outer-${id}`);
    const $folderShowcase = $(`.folder-showcase-${id}`);
    const $folderStorage = $(`span#folder-id-${id}`).siblings('div.folder-storage');
    const state = $folderOuter.attr('expanded') === "true";
    
    if(folderDebugMode) {
        console.log(`[FV2_DEBUG] expandFolderVM (id: ${id}): Current state=${state}, toggling to ${!state}`);
    }
    
    if (state) {
        // Collapsing: Move VMs back to storage and hide showcase
        $folderStorage.append($folderShowcase.children());
        $folderOuter.attr('expanded', 'false');
        $(`span#folder-id-${id}`).attr('expanded', 'false');
        
        // Change indicator back to "+" and move to preview area
        const $previewArea = $(`#folder-preview-${id}`);
        const $contractIndicator = $folderShowcase.find('.folder-contract-indicator');
        if ($contractIndicator.length) {
            $contractIndicator.remove();
        }
        // Restore "+" indicator only if there are MORE than 3 VMs (not exactly 3)
        if ($folderStorage.children().length > 3 && !$previewArea.find('.folder-more-indicator').length) {
            const moreIndicator = $('<span class="folder-more-indicator" onclick="expandFolderVM(\'' + id + '\')" title="Click to expand folder">+</span>');
            $previewArea.append(moreIndicator);
        }
    } else {
        // Expanding: Move all VMs from storage to showcase
        $folderShowcase.append($folderStorage.children());
        $folderOuter.attr('expanded', 'true');
        $(`span#folder-id-${id}`).attr('expanded', 'true');
        
        // Add "-" indicator to contract in the showcase area
        if (!$folderShowcase.find('.folder-contract-indicator').length) {
            const contractIndicator = $('<span class="folder-contract-indicator folder-more-indicator" onclick="expandFolderVM(\'' + id + '\')" title="Click to contract folder">-</span>');
            $folderShowcase.append(contractIndicator);
        }
        
        // Remove "+" indicator from preview area
        $(`#folder-preview-${id} .folder-more-indicator`).remove();
    }
    
    if(globalFolders.vms) {
        globalFolders.vms[id].status.expanded = !state;
        
        // Persist VM folder expansion state to localStorage
        try {
            const folderStates = JSON.parse(localStorage.getItem('folderView2_vmStates') || '{}');
            folderStates[id] = !state;
            localStorage.setItem('folderView2_vmStates', JSON.stringify(folderStates));
            console.log(`[FV2_DEBUG] expandFolderVM (id: ${id}): Persisted expanded state ${!state} to localStorage.`);
        } catch (e) {
            console.warn(`[FV2_DEBUG] expandFolderVM (id: ${id}): Failed to persist state to localStorage:`, e);
        }
    }
    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-expansion', {detail: { id }}));
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmDockerFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.docker[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: $.i18n('yes-delete'),
        cancelButtonText: $.i18n('cancel'),
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.get('/plugins/folder.view2/server/delete.php?type=docker&id=' + id).promise();
        loadedFolder = false;
        setTimeout(loadlist(), 500)
    });
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmVMFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.vms[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: $.i18n('yes-delete'),
        cancelButtonText: $.i18n('cancel'),
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.get('/plugins/folder.view2/server/delete.php?type=vm&id=' + id).promise();
        loadedFolder = false;
        setTimeout(loadlist(), 500)
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editDockerFolder = (id) => {
    location.href = location.pathname + "/Folder?type=docker&id=" + id;
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editVMFolder = (id) => {
    location.href = location.pathname + "/Folder?type=vm&id=" + id;
};

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderDockerCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const folder = globalFolders.docker[id];
    let act = folder.actions[action];
    let prom = [];
    if(act.type === 0) {
        const cts = act.conatiners.map(e => folder.containers[e]).filter(e => e);
        let ctAction = (e) => {};
        if(act.action === 0) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    } else {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        if(e.pause) {
                            prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                        } else {
                            prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                        }
                    }
                };
            }

        } else if(act.action === 1) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(!e.state) {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 2) {
                ctAction = (e) => {
                    if(e.state && !e.pause) {
                        prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 3) {
                ctAction = (e) => {
                    if(e.state && e.pause) {
                        prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 2) {

            ctAction = (e) => {
                prom.push($.post(eventURL, {action: 'restart', container:e.id}, null,'json').promise());
            };

        }

        cts.forEach((e) => {
            ctAction(e);
        });
    } else if(act.type === 1) {
        const args = act.script_args || '';
        if(act.script_sync) {
            let scriptVariables = {}
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if(scriptVariables['directPHP']) {
                $.post("/plugins/user.scripts/exec.php",{action:'directRunScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) { openBox(data,act.name,800,1200, 'loadlist');}})
            } else {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
            }
        } else {
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
        }
    }

    await Promise.all(prom);

    loadlist();
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#docker_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderDocker(id); }
    });

    opts.push({
        divider: true
    });

    if(globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push(
            ...globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.docker[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: 'fa-play',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "start"); }
        });
        opts.push({
            text: $.i18n('stop'),
            icon: 'fa-stop',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "stop"); }
        });
        
        opts.push({
            text: $.i18n('pause'),
            icon: 'fa-pause',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "pause"); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: 'fa-play-circle',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "resume"); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: 'fa-refresh',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "restart"); }
        });
    
        opts.push({
            divider: true
        });
    }

    if(globalFolders.docker[id].status.managed > 0) {
        if(!globalFolders.docker[id].status.upToDate) {
            opts.push({
                text: $.i18n('update'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault();  updateFolderDocker(id); }
            });
        } else {
            opts.push({
                text: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault(); forceUpdateFolderDocker(id); }
            });
        }
        
        opts.push({
            divider: true
        });
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editDockerFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmDockerFolder(id); }
    });

    if(!globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderDockerCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed && v.update).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderDocker = async (id, action) => {
    const folder =  globalFolders.docker[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        switch (action) {
            case "start":
                pass = !ct.state;
                break;
            case "stop":
                pass = ct.state;
                break;
            case "pause":
                pass = ct.state && !ct.pause;
                break;
            case "resume":
                pass = ct.state && ct.pause;
                break;
            case "resume":
                pass = true;
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post(eventURL, {action: action, container:cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderVMCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const eventURL = '/plugins/dynamix.vm.manager/include/VMajax.php';
    const folder = globalFolders.vms[id];
    let act = folder.actions[action];
    let prom = [];
    if(act.type === 0) {
        const cts = act.conatiners.map(e => folder.containers[e]).filter(e => e);
        let ctAction = (e) => {};
        if(act.action === 0) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'stop', uuid:e.id}, null,'json').promise());
                    } else if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown"){
                        prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                    } else if(e.state === "paused" || e.state === "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-resume', uuid:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 1) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-stop', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 2) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 3) {
                ctAction = (e) => {
                    if(e.state === "paused" || e.state === "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-restart', uuid:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 2) {

            ctAction = (e) => {
                if(e.state === "running") {
                    prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                }
            };

        }

        cts.forEach((e) => {
            ctAction(e);
        });
    } else if(act.type === 1) {
        const args = act.script_args || '';
        if(act.script_sync) {
            let scriptVariables = {}
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if(scriptVariables['directPHP']) {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
            } else {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2=',act.name,800,1200,true, 'loadlist');}});
            }
        } else {
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
        }
    }

    await Promise.all(prom);

    loadlist();
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addVMFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#vm_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderVM(id); }
    });
    
    opts.push({
        divider: true
    });

    if(globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push(
            ...globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.vms[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: "fa-play",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-start'); }
        });
    
        opts.push({
            text: $.i18n('stop'),
            icon: "fa-stop",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-stop'); }
        });
    
        opts.push({
            text: $.i18n('pause'),
            icon: "fa-pause",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pause'); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: "fa-play-circle",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-resume'); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: "fa-refresh",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-restart'); }
        });
    
        opts.push({
            text: $.i18n('hibernate'),
            icon: "fa-bed",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pmsuspend'); }
        });
    
        opts.push({
            text: $.i18n('force-stop'),
            icon: "fa-bomb",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-destroy'); }
        });
    
        opts.push({
            divider: true
        });
    }


    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editVMFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmVMFolder(id); }
    });

    if(!globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderVMCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderVM = async (id, action) => {
    const folder =  globalFolders.vms[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;
    const oldAction = action;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        action = oldAction;
        switch (action) {
            case "domain-start":
                pass = ct.state !== "running" && ct.state !== "pmsuspended" && ct.state !== "paused" && ct.state !== "unknown";
                break;
            case "domain-stop":
            case "domain-pause":
            case "domain-restart":
            case "domain-pmsuspend":
                pass = ct.state === "running";
                break;
            case "domain-resume":
                pass = ct.state === "paused" || ct.state === "unknown";
                if(!pass) {
                    pass = ct.state === "pmsuspended";
                    action = "domain-pmwakeup";
                }
                break;
            case "domain-destroy":
                pass = ct.state === "running" || ct.state === "pmsuspended" || ct.state === "paused" || ct.state === "unknown";
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post('/plugins/dynamix.vm.manager/include/VMajax.php', {action: action, uuid: cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

// Global variables
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode = false; // Debug mode disabled by default
let folderDebugModeWindow = [];
let folderReq = {
    docker: [],
    vm: []
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    if($('tbody#docker_view').length > 0) { 
        folderReq.docker = [
            // Get the folders
            $.get('/plugins/folder.view2/server/read.php?type=docker').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folder.view2/server/read_order.php?type=docker').promise(),
            // Get the info on containers, needed for autostart, update and started
            $.get('/plugins/folder.view2/server/read_info.php?type=docker').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folder.view2/server/read_unraid_order.php?type=docker').promise()
        ];
    }

    if($('tbody#vm_view').length > 0) {
        folderReq.vm = [
            // Get the folders
            $.get('/plugins/folder.view2/server/read.php?type=vm').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folder.view2/server/read_order.php?type=vm').promise(),
            // Get the info on VMs, needed for autostart and started
            $.get('/plugins/folder.view2/server/read_info.php?type=vm').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folder.view2/server/read_unraid_order.php?type=vm').promise()
        ];
    }
    loadlist_original(x);
};

// Folders Only Toggle Functionality - Separate for Docker and VM
let dockerFoldersOnlyMode = false;
let vmFoldersOnlyMode = false;

// Initialize folders-only toggles
const initFoldersOnlyToggle = () => {
    // Initialize Docker toggle - attach to Docker header row
    const $dockerHeaderRow = $('tbody#docker_view tr:first-child td:first-child');
    if ($dockerHeaderRow.length && !$dockerHeaderRow.find('#dockerFoldersOnlySwitch').length) {
        const dockerToggleHtml = `
            <div class="folders-only-toggle docker-toggle">
                <span>Folders Only</span>
                <div class="folders-only-switch" id="dockerFoldersOnlySwitch">
                </div>
            </div>
        `;
        $dockerHeaderRow.append(dockerToggleHtml);
        
        // Restore Docker state
        try {
            const savedState = localStorage.getItem('folderView2_dockerFoldersOnlyMode');
            dockerFoldersOnlyMode = savedState === 'true';
        } catch (e) {
            console.warn('[FV2] Failed to restore Docker folders-only mode state:', e);
        }
        
        // Add Docker click handler with event isolation
        $('#dockerFoldersOnlySwitch').off('click').on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            toggleDockerFoldersOnlyMode();
        });
    }
    
    // Initialize VM toggle - attach to VM header row
    const $vmHeaderRow = $('tbody#vm_view tr:first-child td:first-child');
    if ($vmHeaderRow.length && !$vmHeaderRow.find('#vmFoldersOnlySwitch').length) {
        const vmToggleHtml = `
            <div class="folders-only-toggle vm-toggle">
                <span>Folders Only</span>
                <div class="folders-only-switch" id="vmFoldersOnlySwitch">
                </div>
            </div>
        `;
        $vmHeaderRow.append(vmToggleHtml);
        
        // Restore VM state
        try {
            const savedState = localStorage.getItem('folderView2_vmFoldersOnlyMode');
            vmFoldersOnlyMode = savedState === 'true';
        } catch (e) {
            console.warn('[FV2] Failed to restore VM folders-only mode state:', e);
        }
        
        // Add VM click handler with event isolation
        $('#vmFoldersOnlySwitch').off('click').on('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            toggleVMFoldersOnlyMode();
        });
    }
    
    // Update initial states
    updateFoldersOnlyMode();
};

// Toggle Docker folders-only mode
const toggleDockerFoldersOnlyMode = () => {
    dockerFoldersOnlyMode = !dockerFoldersOnlyMode;
    console.log('[FV2] Docker toggle clicked. New state:', dockerFoldersOnlyMode);
    
    // Save state to localStorage
    try {
        localStorage.setItem('folderView2_dockerFoldersOnlyMode', dockerFoldersOnlyMode.toString());
    } catch (e) {
        console.warn('[FV2] Failed to save Docker folders-only mode state:', e);
    }
    
    updateFoldersOnlyMode();
};

// Toggle VM folders-only mode
const toggleVMFoldersOnlyMode = () => {
    vmFoldersOnlyMode = !vmFoldersOnlyMode;
    console.log('[FV2] VM toggle clicked. New state:', vmFoldersOnlyMode);
    
    // Save state to localStorage
    try {
        localStorage.setItem('folderView2_vmFoldersOnlyMode', vmFoldersOnlyMode.toString());
    } catch (e) {
        console.warn('[FV2] Failed to save VM folders-only mode state:', e);
    }
    
    updateFoldersOnlyMode();
};

// Update the visual state and layout
const updateFoldersOnlyMode = () => {
    const $body = $('body');
    const $dockerSwitch = $('#dockerFoldersOnlySwitch');
    const $vmSwitch = $('#vmFoldersOnlySwitch');
    
    console.log('[FV2] updateFoldersOnlyMode called. Docker:', dockerFoldersOnlyMode, 'VM:', vmFoldersOnlyMode);
    
    // Update Docker section
    if (dockerFoldersOnlyMode) {
        $body.addClass('docker-folders-only-mode');
        $dockerSwitch.addClass('active');
        console.log('[FV2] Docker folders-only mode ENABLED');
    } else {
        $body.removeClass('docker-folders-only-mode');
        $dockerSwitch.removeClass('active');
        console.log('[FV2] Docker folders-only mode DISABLED');
    }
    
    // Update VM section
    if (vmFoldersOnlyMode) {
        $body.addClass('vm-folders-only-mode');
        $vmSwitch.addClass('active');
        console.log('[FV2] VM folders-only mode ENABLED');
    } else {
        $body.removeClass('vm-folders-only-mode');
        $vmSwitch.removeClass('active');
        console.log('[FV2] VM folders-only mode DISABLED');
    }
    
    console.log('[FV2] Body classes after update:', $body.attr('class'));
};

// Initialize toggle when DOM is ready
$(document).ready(() => {
    // Multiple initialization attempts to ensure it works
    setTimeout(initFoldersOnlyToggle, 500);
    setTimeout(initFoldersOnlyToggle, 1000);
    setTimeout(initFoldersOnlyToggle, 2000);
});

// Also initialize after folder creation is complete
$(document).on('docker-post-folders-creation vm-post-folders-creation', () => {
    setTimeout(initFoldersOnlyToggle, 100);
});

// this is needed to trigger the funtion to create the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/webGui/include/DashboardApps.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            createFolders();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
        });
    }
});

// activate debug mode
addEventListener("keydown", (e) => {
    if (e.isComposing || e.key.length !== 1) { // letter X FOR TESTING
        return;
    }
    folderDebugModeWindow.push(e.key);
    if(folderDebugModeWindow.length > 5) {
        folderDebugModeWindow.shift();
    }
    if(folderDebugModeWindow.join('').toLowerCase() === "debug") {
        folderDebugMode = true;
        loadlist();
    }
})