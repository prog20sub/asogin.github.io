// --- 0. VERIFICACIÓN DE SESIÓN Y SEGURIDAD ---
const sesionActual = JSON.parse(localStorage.getItem('gym_sesion'));

// Si no ha iniciado sesión, redirigir al login de inmediato
if (!sesionActual) {
    window.location.href = 'login.html';
}

console.log(`Sesión activa: Usuario=${sesionActual.usuario}, Rol=${sesionActual.rol}, Sede=${sesionActual.sede}`);

// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variable global para almacenar temporalmente la fecha de vencimiento anterior al renovar
let fechaVencimientoAnteriorGlobal = null;
let clientesGlobales = []; // Almacena los registros cargados para permitir el filtrado instantáneo local

// --- TABLA DE PRECIOS ---
const PRECIOS_PLANES = {
    "Solo máquinas": { Diario: 5, Semanal: 15, Mensual: 45 },
    "Guiado": { Semanal: 20, Mensual: 65 },
    "Asistido": { Diario: 8, Semanal: 25, Mensual: 90 },
    "Personalizado": { Semanal: 40, Mensual: 150 },
    "Edad plateada grupal": { Mensual: 60 },
    "Edad plateada individual": { Mensual: 90 },
    "Funcional híbrido": { Diario: 6, Mensual: 45 },
    "Funcional híbrido B": { Diario: 4, Mensual: 25 },
    "Mayckol N": { Semanal: 60, Quincenal: 45, Mensual: 90 },
    "Mayckol A": { Semanal: 50, Quincenal: 40, Mensual: 80 }
};

// --- AUTOPRELLENADO DE MONTO SEGÚN PLAN Y MODALIDAD ---
const selectPlan = document.getElementById('plan');
const selectModalidad = document.getElementById('modalidad');
const inputMonto = document.getElementById('monto');
const inputFechaPago = document.getElementById('fecha_pago');

if (inputFechaPago) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaPago.value = hoy;
}

function actualizarMontoSugerido() {
    if (!selectPlan || !selectModalidad || !inputMonto) return;
    const plan = selectPlan.value;
    const modalidad = selectModalidad.value;

    if (plan && modalidad && PRECIOS_PLANES[plan] && PRECIOS_PLANES[plan][modalidad]) {
        inputMonto.value = PRECIOS_PLANES[plan][modalidad];
    }
}

if (selectPlan) selectPlan.addEventListener('change', actualizarMontoSugerido);
if (selectModalidad) selectModalidad.addEventListener('change', actualizarMontoSugerido);

// --- FILTRAR PLANES DINÁMICAMENTE SEGÚN EL ROL DEL USUARIO ---
window.addEventListener('DOMContentLoaded', () => {
    if (!selectPlan || !sesionActual) return;

    const opciones = selectPlan.options;

    for (let i = 0; i < opciones.length; i++) {
        const valorPlan = opciones[i].value;
        if (!valorPlan) continue;

        const esPlanMayckol = valorPlan.includes('Mayckol');

        if (sesionActual.rol === 'trinidad') {
            if (esPlanMayckol) {
                opciones[i].style.display = 'none';
            }
        } else if (sesionActual.rol === 'mayckol') {
            if (!esPlanMayckol) {
                opciones[i].style.display = 'none';
            }
        }
    }
});

// --- FUNCIÓN MATEMÁTICA PARA SUMAR 1 MES EXACTO ---
function sumarUnMes(fechaBaseStr) {
    let fechaBase;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaBaseStr) {
        const [year, mes, dia] = fechaBaseStr.split('T')[0].split('-').map(Number);
        fechaBase = new Date(year, mes - 1, dia);
        
        if (fechaBase < hoy) {
            fechaBase = hoy;
        }
    } else {
        fechaBase = hoy;
    }

    let nuevoYear = fechaBase.getFullYear();
    let nuevoMes = fechaBase.getMonth() + 1;
    let nuevoDia = fechaBase.getDate();

    if (nuevoMes > 11) {
        nuevoMes = 0;
        nuevoYear++;
    }

    const ultimoDiaMesDestino = new Date(nuevoYear, nuevoMes + 1, 0).getDate();
    if (nuevoDia > ultimoDiaMesDestino) {
        nuevoDia = ultimoDiaMesDestino;
    }

    const mesFormateado = String(nuevoMes + 1).padStart(2, '0');
    const diaFormateado = String(nuevoDia).padStart(2, '0');
    
    return `${nuevoYear}-${mesFormateado}-${diaFormateado}`;
}

function calcularFechaVencimiento(fechaPagoStr, modalidad) {
    let baseCalculo = fechaPagoStr;
    if (modalidad === 'Mensual' && fechaVencimientoAnteriorGlobal) {
        baseCalculo = fechaVencimientoAnteriorGlobal;
    }

    const [year, month, day] = baseCalculo.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);

    if (modalidad === 'Diario') {
        fecha.setDate(fecha.getDate() + 1);
    } else if (modalidad === 'Semanal') {
        fecha.setDate(fecha.getDate() + 7);
    } else if (modalidad === 'Quincenal') {
        fecha.setDate(fecha.getDate() + 15);
    } else if (modalidad === 'Mensual') {
        return sumarUnMes(baseCalculo);
    }

    return fecha.toISOString().split('T')[0];
}

// --- FUNCIÓN GLOBAL DIRECTA PARA WHATSAPP ---
function enviarWhatsApp(celular, mensaje) {
    if (!celular || String(celular).toUpperCase().includes('N/A') || String(celular).toUpperCase().includes('NULL') || String(celular).toUpperCase().includes('EMPTY')) {
        alert("El cliente no tiene un número de celular válido registrado.");
        return;
    }

    let numeroLimpio = String(celular).replace(/\D/g, '');

    if (!numeroLimpio) {
        alert("El número de celular registrado no contiene dígitos válidos.");
        return;
    }

    if (numeroLimpio.startsWith('0')) {
        numeroLimpio = '58' + numeroLimpio.substring(1);
    } else if (!numeroLimpio.startsWith('58')) {
        numeroLimpio = '58' + numeroLimpio;
    }

    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// --- FUNCIÓN PARA CERRAR SESIÓN ---
function cerrarSesion() {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        localStorage.removeItem('gym_sesion');
        window.location.href = 'login.html';
    }
}

// --- SISTEMA DE NOTIFICACIONES Y SONIDO ---
function solicitarPermisoNotificaciones() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function reproducirAlertaSonora() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
        console.log("Audio bloqueado por el navegador.", e);
    }
}

function dispararNotificacionDispositivo(titulo, mensaje) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(titulo, { body: mensaje });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(titulo, { body: mensaje });
            }
        });
    }
}

// --- REGISTRAR NUEVO CLIENTE / PAGO ---
const formCliente = document.getElementById('form-cliente');
if (formCliente) {
    formCliente.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnGuardar = document.getElementById('btn-guardar');
        const mensajeEstado = document.getElementById('mensaje-estado');
        mensajeEstado.textContent = "";
        btnGuardar.textContent = "Guardando...";
        btnGuardar.disabled = true;

        try {
            const cedula = document.getElementById('cedula').value.trim();
            const nombre = document.getElementById('nombre').value.trim();
            const apellido = document.getElementById('apellido').value.trim();
            const celular = document.getElementById('celular').value.trim();
            const sede = document.getElementById('sede').value; 
            const metodo_pago = document.getElementById('metodo_pago').value;
            const plan = document.getElementById('plan').value;
            const modalidad = document.getElementById('modalidad').value;
            const monto = parseFloat(document.getElementById('monto').value);
            const fecha_pago = document.getElementById('fecha_pago').value;
            const cobrado_por = document.getElementById('cobrado_por').value.trim();
            const inputFoto = document.getElementById('foto');

            let foto_url = "";

            if (inputFoto && inputFoto.files.length > 0) {
                const archivo = inputFoto.files[0];
                const nombreArchivo = `${Date.now()}_${archivo.name}`;
                
                const { data: uploadData, error: uploadError } = await _supabase.storage
                    .from('fotos_clientes')
                    .upload(nombreArchivo, archivo);

                if (uploadError) throw uploadError;

                const { data: publicURLData } = _supabase.storage
                    .from('fotos_clientes')
                    .getPublicUrl(nombreArchivo);

                foto_url = publicURLData.publicUrl;
            }

            if (sesionActual.rol === 'trinidad' && plan.includes('Mayckol')) {
                throw new Error("No tienes autorización para registrar o modificar planes de Mayckol.");
            }
            if (sesionActual.rol === 'mayckol' && !plan.includes('Mayckol')) {
                throw new Error("Solo tienes autorización para registrar o modificar planes de Mayckol.");
            }

            const fecha_vencimiento = calcularFechaVencimiento(fecha_pago, modalidad);
            const estado = 'Activo';

            const { data: clienteExistente } = await _supabase
                .from('clientes')
                .select('id')
                .eq('cedula', cedula)
                .maybeSingle();

            let errorDb;

            if (clienteExistente) {
                const { error } = await _supabase
                    .from('clientes')
                    .update({
                        nombre, apellido, celular, sede, metodo_pago, plan, modalidad, monto, fecha_pago, fecha_vencimiento, estado, cobrado_por,
                        ...(foto_url ? { foto_url } : {})
                    })
                    .eq('cedula', cedula);
                errorDb = error;
            } else {
                const { error } = await _supabase
                    .from('clientes')
                    .insert([{
                        cedula, nombre, apellido, celular, sede, metodo_pago, foto_url, plan, modalidad, monto, fecha_pago, fecha_vencimiento, estado, cobrado_por
                    }]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;

            fechaVencimientoAnteriorGlobal = null;
            const avisoAnterior = document.getElementById('aviso-fecha-corte');
            if (avisoAnterior) avisoAnterior.remove();

            mensajeEstado.style.color = "green";
            mensajeEstado.textContent = "✅ ¡Cliente registrado y membresía activada con éxito!";
            formCliente.reset();
            if (inputFechaPago) inputFechaPago.value = new Date().toISOString().split('T')[0];
            
            cargarListasClientes();

        } catch (error) {
            console.error("Error al guardar:", error);
            mensajeEstado.style.color = "red";
            mensajeEstado.textContent = "❌ Error al guardar: " + (error.message || "Verifica tu conexión.");
        } finally {
            btnGuardar.textContent = "Guardar y Activar Membresía";
            btnGuardar.disabled = false;
        }
    });
}

// --- CARGAR Y DISTRIBUIR CLIENTES EN LAS LISTAS ---
async function cargarListasClientes() {
    solicitarPermisoNotificaciones();

    const listaActivos = document.getElementById('lista-activos');
    const listaVencidos = document.getElementById('lista-vencidos');

    if (!listaActivos || !listaVencidos) return;

    const { data: clientes, error } = await _supabase
        .from('clientes')
        .select('*')
        .order('fecha_vencimiento', { ascending: true });

    if (error) {
        console.error("Error al cargar clientes:", error);
        listaActivos.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar datos.</td></tr>`;
        return;
    }

    if (!clientes || clientes.length === 0) {
        listaActivos.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay clientes registrados.</td></tr>`;
        listaVencidos.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay deudores registrados.</td></tr>`;
        return;
    }

    clientesGlobales = clientes;
    renderizarListas(clientesGlobales);
}

// Función encargada de renderizar aplicando búsqueda, sede y plan de manera combinada
function renderizarListas(clientes) {
    const listaActivos = document.getElementById('lista-activos');
    const listaVencidos = document.getElementById('lista-vencidos');

    const textoBusqueda = document.getElementById('input-buscar-activo') ? document.getElementById('input-buscar-activo').value.toLowerCase() : '';
    const sedeSeleccionada = document.getElementById('filtro-sede-activo') ? document.getElementById('filtro-sede-activo').value : '';
    const planSeleccionado = document.getElementById('filtro-plan-activo') ? document.getElementById('filtro-plan-activo').value : '';

    const hoyStr = new Date().toISOString().split('T')[0];
    const [yearHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number);
    const fechaHoyNum = new Date(yearHoy, mesHoy - 1, diaHoy).getTime();

    let htmlActivos = '';
    let htmlVencidos = '';

    let contadorActivos = 0;
    let contadorVencidos = 0;
    let clientesPorVencerManana = [];

    for (let cliente of clientes) {
        const fechaVencStr = cliente.fecha_vencimiento.split('T')[0];
        const [yearVenc, mesVenc, diaVenc] = fechaVencStr.split('-').map(Number);
        const fechaVencNum = new Date(yearVenc, mesVenc - 1, diaVenc).getTime();
        
        const diferenciaTiempo = fechaVencNum - fechaHoyNum;
        const diasRestantes = Math.round(diferenciaTiempo / (1000 * 60 * 60 * 24));

        let estadoVisual = 'Activo';
        let claseBadge = 'badge-activo';

        if (diasRestantes < 0) {
            estadoVisual = 'Vencido';
            claseBadge = 'badge-vencido';
        } else if (diasRestantes <= 2) {
            estadoVisual = 'Por vencer';
            claseBadge = 'badge-por-vencer';
        }

        // Filtros combinados: Buscador de texto, Sede y Plan
        const textoCliente = `${cliente.cedula} ${cliente.nombre} ${cliente.apellido}`.toLowerCase();
        const coincideBusqueda = textoCliente.includes(textoBusqueda);
        const coincideSede = sedeSeleccionada === "" || cliente.sede === sedeSeleccionada;
        const coincidePlan = planSeleccionado === "" || cliente.plan === planSeleccionado;

        if (!coincideBusqueda || !coincideSede || !coincidePlan) continue;

        if (diasRestantes === 1) {
            clientesPorVencerManana.push(`${cliente.nombre} ${cliente.apellido}`);
        }

        const badgeSede = cliente.sede === 'La Trinidad' 
            ? 'background: rgba(33, 150, 243, 0.15); color: #64b5f6; border: 1px solid rgba(33, 150, 243, 0.3); padding: 2px 6px; border-radius: 6px; font-size: 0.75rem; font-weight: 500; display: inline-block;' 
            : 'background: rgba(76, 175, 80, 0.15); color: #81c784; border: 1px solid rgba(76, 175, 80, 0.3); padding: 2px 6px; border-radius: 6px; font-size: 0.75rem; font-weight: 500; display: inline-block;';

        const celularCrudo = cliente.celular ? String(cliente.celular).trim() : '';
        const celularMayus = celularCrudo.toUpperCase();
        const tieneCelularValido = celularCrudo !== '' && !celularMayus.includes('N/A') && !celularMayus.includes('NULL') && !celularMayus.includes('EMPTY') && celularCrudo.replace(/\D/g, '').length > 0;

        if (diasRestantes < 0) {
            if (cliente.modalidad === 'Mensual' || cliente.modalidad === 'Quincenal') {
                contadorVencidos++;
                const diasVencido = Math.abs(diasRestantes);
                const mensajeCobro = `Hola ${cliente.nombre}, te escribimos de Gym Control. Notamos que tu membresía del plan ${cliente.plan} tiene ${diasVencido} días vencida. ¡Te esperamos para renovar y seguir entrenando! 💪`;

                htmlVencidos += `
                    <tr>
                        <td><strong>${cliente.cedula}</strong></td>
                        <td>${cliente.nombre} ${cliente.apellido}</td>
                        <td><span style="${badgeSede}">${cliente.sede || 'No asignada'}</span></td>
                        <td><span class="badge badge-vencido">${diasVencido} días vencido</span></td>
                        <td>$${cliente.monto}</td>
                        <td>
                            <button class="btn-renovar" onclick="renovarCliente('${cliente.cedula}')">Renovar / Pagar</button>
                            ${tieneCelularValido ? `<button onclick="enviarWhatsApp('${celularCrudo}', '${mensajeCobro}')" style="background: #25d366; color: white; width: 26px; height: 26px; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 6px; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); vertical-align: middle;" title="Enviar WhatsApp">💬</button>` : ''}
                        </td>
                    </tr>
                `;
            }
        } else {
            contadorActivos++;
            
            const mensajeRecordatorio = `Hola ${cliente.nombre}, te saludamos de Gym Control. Te recordamos que tu plan ${cliente.plan} vence el ${cliente.fecha_vencimiento}. ¡Te esperamos!`;

            htmlActivos += `
                <tr>
                    <td><strong>${cliente.cedula}</strong></td>
                    <td>${cliente.nombre} ${cliente.apellido}</td>
                    <td><span style="${badgeSede}">${cliente.sede || 'No asignada'}</span></td>
                    <td>${cliente.plan} (${cliente.modalidad})</td>
                    <td><span class="badge ${claseBadge}">${estadoVisual}</span></td>
                    <td>
                        ${cliente.fecha_vencimiento}
                        ${tieneCelularValido ? `<button onclick="enviarWhatsApp('${celularCrudo}', '${mensajeRecordatorio}')" style="background: #25d366; color: white; width: 26px; height: 26px; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 6px; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); vertical-align: middle;" title="Enviar Recordatorio">💬</button>` : ''}
                    </td>
                </tr>
            `;
        }
    }

    if (clientesPorVencerManana.length > 0) {
        const ultimaAlertaManana = localStorage.getItem('gym_ultima_alerta_por_vencer');
        if (ultimaAlertaManana !== hoyStr) {
            reproducirAlertaSonora();
            const nombresListados = clientesPorVencerManana.join(', ');
            dispararNotificacionDispositivo(
                "⏳ Membresía por vencer mañana", 
                `Atención: A ${nombresListados} se le vence la membresía mañana.`
            );
            localStorage.setItem('gym_ultima_alerta_por_vencer', hoyStr);
        }
    }

    if (contadorVencidos > 0) {
        const ultimaAlertaVencidos = localStorage.getItem('gym_ultima_alerta_vencidos');
        if (ultimaAlertaVencidos !== hoyStr) {
            reproducirAlertaSonora();
            dispararNotificacionDispositivo(
                "⚠️ ¡Atención en el Gimnasio!", 
                `Hay ${contadorVencidos} cliente(s) con cuota o mensualidad vencida que requieren cobro.`
            );
            localStorage.setItem('gym_ultima_alerta_vencidos', hoyStr);
        }
    }

    if (contadorActivos === 0) {
        listaActivos.innerHTML = `<tr><td colspan="6" style="text-align: center;">No se encontraron clientes activos con esos criterios.</td></tr>`;
    } else {
        listaActivos.innerHTML = htmlActivos;
    }

    if (contadorVencidos === 0) {
        listaVencidos.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay deudores que coincidan con la búsqueda.</td></tr>`;
    } else {
        listaVencidos.innerHTML = htmlVencidos;
    }
}

// Función activada por el buscador y selectores de filtro
function filtrarClientesActivos() {
    renderizarListas(clientesGlobales);
}

// --- FUNCIÓN DE RENOVACIÓN / EDICIÓN CON VALIDACIÓN DE ROLES ---
async function renovarCliente(cedula) {
    const { data: cliente, error } = await _supabase
        .from('clientes')
        .select('*')
        .eq('cedula', cedula)
        .single();

    if (error || !cliente) {
        alert("No se pudo cargar la información del cliente.");
        return;
    }

    const esPlanMayckol = cliente.plan && cliente.plan.includes('Mayckol');

    if (sesionActual.rol === 'trinidad' && esPlanMayckol) {
        alert("No tienes autorización para editar o renovar clientes de Mayckol.");
        return;
    }
    if (sesionActual.rol === 'mayckol' && !esPlanMayckol) {
        alert("Solo tienes autorización para editar o renovar clientes de Mayckol.");
        return;
    }

    document.getElementById('cedula').value = cliente.cedula;
    document.getElementById('nombre').value = cliente.nombre;
    document.getElementById('apellido').value = cliente.apellido;
    document.getElementById('celular').value = cliente.celular || '';
    
    const inputSede = document.getElementById('sede');
    if (inputSede) {
        inputSede.value = cliente.sede || '';
    }

    const inputMetodoPago = document.getElementById('metodo_pago');
    if (inputMetodoPago) {
        inputMetodoPago.value = cliente.metodo_pago || '';
    }

    document.getElementById('plan').value = cliente.plan;
    document.getElementById('modalidad').value = cliente.modalidad;
    document.getElementById('monto').value = cliente.monto;
    
    const inputCobrado = document.getElementById('cobrado_por');
    if (inputCobrado) {
        inputCobrado.value = cliente.cobrado_por || '';
    }
    
    if (cliente.fecha_vencimiento) {
        fechaVencimientoAnteriorGlobal = cliente.fecha_vencimiento.split('T')[0];
    } else {
        fechaVencimientoAnteriorGlobal = null;
    }

    const inputFechaPago = document.getElementById('fecha_pago');
    if (inputFechaPago) {
        inputFechaPago.value = new Date().toISOString().split('T')[0];
        
        let avisoDiv = document.getElementById('aviso-fecha-corte');
        if (!avisoDiv) {
            avisoDiv = document.createElement('div');
            avisoDiv.id = 'aviso-fecha-corte';
            avisoDiv.style.cssText = "margin-top: 5px; font-size: 0.85rem; color: #0d47a1; background: #e3f2fd; padding: 5px 10px; border-radius: 4px;";
            inputFechaPago.parentNode.appendChild(avisoDiv);
        }
        avisoDiv.innerHTML = `📌 <strong>Fecha de corte anterior:</strong> ${fechaVencimientoAnteriorGlobal || 'Ninguna'} (El nuevo mes se sumará a partir de este día).`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('nombre').focus();
}

if (document.getElementById('lista-activos')) {
    cargarListasClientes();
}
