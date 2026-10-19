// --- VERIFICACIÓN DE SESIÓN ---
const sesionActual = JSON.parse(localStorage.getItem('gym_sesion'));
if (!sesionActual) {
    window.location.href = 'login.html';
}

const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let clientesGlobales = [];

// --- FUNCIÓN GLOBAL PARA REGISTRAR EN EL HISTORIAL DE AUDITORÍA ---
async function registrarHistorial(accion, detalle, cedulaAfectada = null) {
    try {
        const sesion = JSON.parse(localStorage.getItem('gym_sesion')) || { usuario: 'Desconocido', rol: 'Sin Rol', sede: 'N/A' };

        await _supabase
            .from('historial_cambios')
            .insert([{
                usuario: sesion.usuario,
                rol: sesion.rol,
                sede: sesion.sede,
                accion: accion,
                detalle: detalle,
                cedula_afectada: cedulaAfectada
            }]);
    } catch (err) {
        console.error("Error al registrar en historial:", err);
    }
}

async function cargarBaseDeDatos() {
    const tablaDatabase = document.getElementById('tabla-database');
    if (!tablaDatabase) return;

    tablaDatabase.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #666;">Cargando registros...</td></tr>`;

    const { data: clientes, error } = await _supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error al cargar la base de datos:", error);
        tablaDatabase.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Error al cargar registros.</td></tr>`;
        return;
    }

    clientesGlobales = clientes || [];
    mostrarClientesEnTabla(clientesGlobales);
}

function mostrarClientesEnTabla(clientes) {
    const tablaDatabase = document.getElementById('tabla-database');
    if (!tablaDatabase) return;

    const textoBusqueda = document.getElementById('buscador') ? document.getElementById('buscador').value.toLowerCase().trim() : '';
    const sedeSeleccionada = document.getElementById('filtro-sede-db') ? document.getElementById('filtro-sede-db').value : '';
    const planSeleccionado = document.getElementById('filtro-plan-db') ? document.getElementById('filtro-plan-db').value : '';

    const hoyStr = new Date().toISOString().split('T')[0];
    const [yearHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number);
    const fechaHoyNum = new Date(yearHoy, mesHoy - 1, diaHoy).getTime();

    let filasHtml = '';
    let contadorVisibles = 0;

    clientes.forEach(c => {
        // Validación de filtros combinados
        const textoCliente = `${c.cedula || ''} ${c.nombre || ''} ${c.apellido || ''}`.toLowerCase();
        const coincideBusqueda = textoCliente.includes(textoBusqueda);
        const coincideSede = sedeSeleccionada === "" || c.sede === sedeSeleccionada;
        const coincidePlan = planSeleccionado === "" || c.plan === planSeleccionado;

        if (!coincideBusqueda || !coincideSede || !coincidePlan) return;

        contadorVisibles++;

        const fotoHtml = c.foto_url 
            ? `<img src="${c.foto_url}" alt="Foto" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
            : `<span style="font-size: 0.8rem; color: #888;">Sin foto</span>`;

        let estadoInactividad = '';
        if (c.fecha_vencimiento) {
            const fechaVencStr = c.fecha_vencimiento.split('T')[0];
            const [yearVenc, mesVenc, diaVenc] = fechaVencStr.split('-').map(Number);
            const fechaVencNum = new Date(yearVenc, mesVenc - 1, diaVenc).getTime();
            
            const diferenciaTiempo = fechaVencNum - fechaHoyNum;
            const diasRestantes = Math.round(diferenciaTiempo / (1000 * 60 * 60 * 24));

            if (diasRestantes < 0) {
                const diasInactivo = Math.abs(diasRestantes);
                estadoInactividad = `<span class="badge badge-vencido" style="background-color: #dc3545; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">Inactivo (${diasInactivo} días)</span>`;
            } else if (diasRestantes === 0) {
                estadoInactividad = `<span class="badge" style="background-color: #ffc107; color: #333; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">Vence hoy</span>`;
            } else {
                estadoInactividad = `<span class="badge badge-activo" style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem;">Activo (${diasRestantes}d rest.)</span>`;
            }
        } else {
            estadoInactividad = `<span style="color: #888;">Sin fecha</span>`;
        }

        const badgeSede = c.sede === 'La Trinidad' 
            ? 'background: #e3f2fd; color: #0d47a1; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;' 
            : 'background: #e8f5e9; color: #1b5e20; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;';

        filasHtml += `
            <tr>
                <td>${fotoHtml}</td>
                <td><strong>${escapeHTML(c.cedula || '')}</strong></td>
                <td>${escapeHTML(c.nombre || '')} ${escapeHTML(c.apellido || '')}</td>
                <td>${escapeHTML(c.celular || 'N/A')}</td>
                <td>${escapeHTML(c.plan || 'Sin plan')} (${escapeHTML(c.modalidad || 'N/A')})</td>
                <td>${estadoInactividad}</td>
                <td>${escapeHTML(c.cobrado_por || 'N/A')}</td>
                <td>
                    <button class="btn-renovar" style="background-color: #ffc107; color: #333;" onclick="abrirEditar(${c.id})">Editar / Borrar</button>
                </td>
                <td><span style="${badgeSede}">${escapeHTML(c.sede || 'No asignada')}</span></td>
            </tr>
        `;
    });

    if (contadorVisibles === 0) {
        tablaDatabase.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron registros que coincidan con los filtros.</td></tr>`;
    } else {
        tablaDatabase.innerHTML = filasHtml;
    }
}

function filtrarClientesDB() {
    mostrarClientesEnTabla(clientesGlobales);
}

function escapeHTML(str) {
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function abrirEditar(id) {
    const cliente = clientesGlobales.find(c => c.id === id);
    if (!cliente) return;

    const esPlanMayckol = cliente.plan && cliente.plan.includes('Mayckol');
    if (sesionActual.rol === 'trinidad' && esPlanMayckol) {
        alert("No tienes autorización para editar o modificar registros de Mayckol.");
        return;
    }
    if (sesionActual.rol === 'mayckol' && !esPlanMayckol) {
        alert("Solo tienes autorización para editar o modificar registros de Mayckol.");
        return;
    }

    document.getElementById('edit-id').value = cliente.id;
    document.getElementById('edit-cedula').value = cliente.cedula || '';
    document.getElementById('edit-nombre').value = cliente.nombre || '';
    document.getElementById('edit-apellido').value = cliente.apellido || '';
    document.getElementById('edit-sede').value = cliente.sede || 'La Trinidad';
    document.getElementById('edit-celular').value = cliente.celular || '';
    document.getElementById('edit-correo').value = cliente.correo || '';
    document.getElementById('edit-cobrado').value = cliente.cobrado_por || '';
    
    if (cliente.fecha_vencimiento) {
        document.getElementById('edit-vencimiento').value = cliente.fecha_vencimiento.split('T')[0];
    } else {
        document.getElementById('edit-vencimiento').value = new Date().toISOString().split('T')[0];
    }

    const inputFotoEdit = document.getElementById('edit-foto');
    if (inputFotoEdit) inputFotoEdit.value = "";

    document.getElementById('modal-editar').style.display = 'block';
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function cerrarModalEditar() {
    document.getElementById('modal-editar').style.display = 'none';
}

const formEditar = document.getElementById('form-editar');
if (formEditar) {
    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitButton = formEditar.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        const id = document.getElementById('edit-id').value;
        const cedula = document.getElementById('edit-cedula').value.trim();
        const nombre = document.getElementById('edit-nombre').value.trim();
        const apellido = document.getElementById('edit-apellido').value.trim();
        const sede = document.getElementById('edit-sede').value;
        const celular = document.getElementById('edit-celular').value.trim();
        const correo = document.getElementById('edit-correo').value.trim();
        const fecha_vencimiento = document.getElementById('edit-vencimiento').value;
        const cobrado_por = document.getElementById('edit-cobrado').value.trim();
        const inputFotoEdit = document.getElementById('edit-foto');

        let foto_url_nueva = null;

        try {
            if (inputFotoEdit && inputFotoEdit.files.length > 0) {
                const archivo = inputFotoEdit.files[0];
                const nombreArchivo = `${Date.now()}_${archivo.name.replace(/\s+/g, '_')}`;
                
                const { error: uploadError } = await _supabase.storage
                    .from('fotos_clientes')
                    .upload(nombreArchivo, archivo);

                if (uploadError) throw uploadError;

                const { data: publicURLData } = _supabase.storage
                    .from('fotos_clientes')
                    .getPublicUrl(nombreArchivo);

                foto_url_nueva = publicURLData.publicUrl;
            }

            const datosActualizados = {
                cedula,
                nombre,
                apellido,
                sede,
                celular,
                correo,
                fecha_vencimiento,
                cobrado_por,
                ...(foto_url_nueva ? { foto_url: foto_url_nueva } : {})
            };

            const { error } = await _supabase
                .from('clientes')
                .update(datosActualizados)
                .eq('id', id);

            if (error) throw error;

            // 🕵️‍♂️ AUDITORÍA: Registrar modificación de cliente
            await registrarHistorial(
                'EDICION_CLIENTE', 
                `Se modificaron los datos personales de ${nombre} ${apellido} (${cedula}). Vencimiento: ${fecha_vencimiento}`, 
                cedula
            );

            alert("✅ Datos actualizados con éxito");
            cerrarModalEditar();
            await cargarBaseDeDatos();

        } catch (error) {
            alert("Error al actualizar: " + (error.message || "Verifica tu conexión."));
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

async function eliminarClienteActual() {
    const id = document.getElementById('edit-id').value;
    const nombreCliente = document.getElementById('edit-nombre').value;
    const cedulaCliente = document.getElementById('edit-cedula').value;

    const confirmar = confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${nombreCliente} del sistema? Esta acción no se puede deshacer.`);
    
    if (!confirmar) return;

    const { error } = await _supabase
        .from('clientes')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al eliminar el cliente: " + error.message);
    } else {
        // 🕵️‍♂️ AUDITORÍA: Registrar eliminación de cliente
        await registrarHistorial(
            'ELIMINAR_CLIENTE', 
            `Se eliminó permanentemente al cliente ${nombreCliente} (${cedulaCliente})`, 
            cedulaCliente
        );

        alert("🗑️ Cliente eliminado del sistema con éxito.");
        cerrarModalEditar();
        await cargarBaseDeDatos();
    }
}

// --- EXPORTAR TODA LA BASE DE DATOS DE CLIENTES A CSV / EXCEL ---
async function exportarClientesACSV() {
    try {
        const { data: clientes, error } = await _supabase
            .from('clientes')
            .select('*')
            .order('nombre', { ascending: true });

        if (error || !clientes || clientes.length === 0) {
            alert("No hay clientes registrados para exportar.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,Cedula,Nombre,Apellido,Celular,Correo,Sede,Plan,Modalidad,Fecha Vencimiento,Cobrado Por\n";

        clientes.forEach(c => {
            const fila = [
                `"${c.cedula || ''}"`,
                `"${c.nombre || ''}"`,
                `"${c.apellido || ''}"`,
                `"${c.celular || ''}"`,
                `"${c.correo || ''}"`,
                `"${c.sede || ''}"`,
                `"${c.plan || ''}"`,
                `"${c.modalidad || ''}"`,
                `"${c.fecha_vencimiento || ''}"`,
                `"${c.cobrado_por || ''}"`
            ];
            csvContent += fila.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `base_datos_clientes_asogin_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);

        // 🕵️‍♂️ AUDITORÍA: Registrar descarga/exportación de la base de datos
        await registrarHistorial('EXPORTAR_EXCEL', 'El usuario descargó un reporte CSV completo de la base de datos de clientes');

    } catch (err) {
        console.error("Error al exportar clientes:", err);
        alert("Hubo un error al generar el archivo de exportación.");
    }
}

function cerrarSesion() {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        localStorage.removeItem('gym_sesion');
        window.location.href = 'login.html';
    }
}

// Carga inicial
cargarBaseDeDatos();
