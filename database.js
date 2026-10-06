const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let clientesGlobales = [];

async function cargarBaseDeDatos() {
    const tablaDatabase = document.getElementById('tabla-database');
    if (!tablaDatabase) return;

    const { data: clientes, error } = await _supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error al cargar la base de datos:", error);
        tablaDatabase.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Error al cargar registros.</td></tr>`;
        return;
    }

    clientesGlobales = clientes || [];
    mostrarClientesEnTabla(clientesGlobales);
}

function mostrarClientesEnTabla(clientes) {
    const tablaDatabase = document.getElementById('tabla-database');
    if (!tablaDatabase) return;

    if (clientes.length === 0) {
        tablaDatabase.innerHTML = `<tr><td colspan="8" style="text-align: center;">No se encontraron clientes.</td></tr>`;
        return;
    }

    // Obtener fecha actual sin hora para calcular inactividad precisa
    const hoyStr = new Date().toISOString().split('T')[0];
    const [yearHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number);
    const fechaHoyNum = new Date(yearHoy, mesHoy - 1, diaHoy).getTime();

    let html = '';
    clientes.forEach(c => {
        const fotoHtml = c.foto_url 
            ? `<img src="${c.foto_url}" alt="Foto" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
            : `<span style="font-size: 0.8rem; color: #888;">Sin foto</span>`;

        // Calcular días de vigencia o inactividad
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

        html += `
            <tr>
                <td>${fotoHtml}</td>
                <td><strong>${c.cedula}</strong></td>
                <td>${c.nombre} ${c.apellido}</td>
                <td>${c.celular || 'N/A'}</td>
                <td>${c.plan || 'Sin plan'} (${c.modalidad || 'N/A'})</td>
                <td>${estadoInactividad}</td>
                <td>${c.cobrado_por || 'N/A'}</td>
                <td>
                    <button class="btn-renovar" style="background-color: #ffc107; color: #333;" onclick="abrirEditar(${c.id})">Editar / Borrar</button>
                </td>
            </tr>
        `;
    });

    tablaDatabase.innerHTML = html;
}

const inputBuscador = document.getElementById('buscador');
if (inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase();
        const filtrados = clientesGlobales.filter(c => 
            c.cedula.toLowerCase().includes(texto) ||
            c.nombre.toLowerCase().includes(texto) ||
            c.apellido.toLowerCase().includes(texto)
        );
        mostrarClientesEnTabla(filtrados);
    });
}

async function abrirEditar(id) {
    const cliente = clientesGlobales.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById('edit-id').value = cliente.id;
    document.getElementById('edit-cedula').value = cliente.cedula;
    document.getElementById('edit-nombre').value = cliente.nombre;
    document.getElementById('edit-apellido').value = cliente.apellido;
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
        const id = document.getElementById('edit-id').value;
        const cedula = document.getElementById('edit-cedula').value.trim();
        const nombre = document.getElementById('edit-nombre').value.trim();
        const apellido = document.getElementById('edit-apellido').value.trim();
        const celular = document.getElementById('edit-celular').value.trim();
        const correo = document.getElementById('edit-correo').value.trim();
        const fecha_vencimiento = document.getElementById('edit-vencimiento').value;
        const cobrado_por = document.getElementById('edit-cobrado').value.trim();
        const inputFotoEdit = document.getElementById('edit-foto');

        let foto_url_nueva = null;

        try {
            if (inputFotoEdit && inputFotoEdit.files.length > 0) {
                const archivo = inputFotoEdit.files[0];
                const nombreArchivo = `${Date.now()}_${archivo.name}`;
                
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

            alert("✅ Datos y vencimiento actualizados con éxito");
            cerrarModalEditar();
            cargarBaseDeDatos();

        } catch (error) {
            alert("Error al actualizar: " + (error.message || "Verifica tu conexión."));
        }
    });
}

async function eliminarClienteActual() {
    const id = document.getElementById('edit-id').value;
    const nombreCliente = document.getElementById('edit-nombre').value;

    const confirmar = confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${nombreCliente} del sistema? Esta acción no se puede deshacer.`);
    
    if (!confirmar) return;

    const { error } = await _supabase
        .from('clientes')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al eliminar el cliente: " + error.message);
    } else {
        alert("🗑️ Cliente eliminado del sistema con éxito.");
        cerrarModalEditar();
        cargarBaseDeDatos();
    }
}

cargarBaseDeDatos();