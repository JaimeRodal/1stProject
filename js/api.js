"use strict";

// importamos el objeto con todos los datos de consumo de electrodomésticos
import { datosElectrodomesticos } from "./electrodomesticos.js";

function redondearDecimal(numero, decimales) {
  let factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

// Proceso 1: Obtener datos de la API: datos en crudo  de precios de la luz por horas
// API ==> datosEnCrudo

async function obtenerDatos() {
  try {
    const res = await fetch(
      "https://bypass-cors-beta.vercel.app/?url=https://api.preciodelaluz.org/v1/prices/all?zone=PCB"
    );
    const datosEnCrudo = await res.json();
    console.log("datosEnCrudo:");
    console.log(datosEnCrudo);
    return datosEnCrudo;
  } catch (error) {
    console.error("Error al coger los datos de la API", error);
    return null;
  }
}

// Proceso 2: Extraer los datos necesarios de los datos en crudo, y maquetarlos en castellano
function extraerDatos() {
  let datosAUsar = [];
  return obtenerDatos().then((datosEnCrudo) => {
    if (datosEnCrudo) {
      for (const clave in datosEnCrudo.data) {
        const hora = clave;
        const precio = datosEnCrudo.data[clave].price;
        const unidades = datosEnCrudo.data[clave].units;
        const media = datosEnCrudo.data[clave]["is-under-avg"];
        datosAUsar.push({ hora, precio, unidades, media });
      }
      console.log("datosAUsar:");
      console.log(datosAUsar);
      return datosAUsar;
    }
  });
}

// Proceso 3: Partiendo de los datos útiles de la API, y de los datos estáticos de consumo por electrodoméstico, se procesan y tenemos como resultado el coste por hora del electrodoméstico, y los costes mayor y menor del mismo a las horas de mayor y menor coste
// datosAUsar ==> datosResultados

function obtenerResultadosAPI() {
  const resultados = extraerDatos();
  return resultados.then((resultados) => {
    // console.log(resultados);
    let fechaActual = new Date();
    let horaActual = fechaActual.getHours();
    let datosResultados = [];
    for (let datos of resultados) {
      const horaToString = parseFloat(datos.hora);
      if (horaActual === horaToString) {
        for (let objeto of datosElectrodomesticos) {
          const electrodomestico = objeto.electrodomestico;
          const coste = (datos.precio * objeto.consumo) / 1000000;
          datosResultados.push({
            electrodomestico: electrodomestico,
            coste: redondearDecimal(coste, 4),
          });
        }
      }
    }
    const precioMax = resultados.sort((a, b) => {
      return b.precio - a.precio;
    });
    const precioMaximo = precioMax[0];
    const precioMinimo = precioMax[precioMax.length - 1];
    console.log(
      `la hora mas cara es: ${precioMaximo.hora}, la hora mas barata es ${precioMinimo.hora}`
    );
    for (let i = 0; i < datosElectrodomesticos.length; i++) {
      const costeMax =
        (datosElectrodomesticos[i].consumo * precioMaximo.precio) / 1000000;
      datosResultados[i].max = redondearDecimal(costeMax, 4);
      datosResultados[i].hora_max = precioMaximo.hora;
      const costeMin =
        (datosElectrodomesticos[i].consumo * precioMinimo.precio) / 1000000;
      datosResultados[i].min = redondearDecimal(costeMin, 4);
      datosResultados[i].hora_min = precioMinimo.hora;
    }
    console.log("datosResultados:");
    console.log(datosResultados);
    return datosResultados;
  });
}

// Proceso 4: Gestionar la caché de datos (resultados), de modo que si no han pasado más de 5 min desde la última vez, los datos se recuperan de la caché de LocalStorage
// ==> datosResultados

const ahora = new Date();
let datosResultados = [];
// Obtención definitiva de resultados del Backend:
obtenerResultados().then((resultados) => {
  datosResultados = resultados;
  console.log(datosResultados);
  mostrarResultados();
});

async function obtenerResultados() {
  let resultados = obtenerResultadosCache();
  // si resultados es falso, hay que recuperar los datos de la API
  if (!resultados) {
    console.log("Solicitando obtención de datos de la API");
    resultados = await obtenerResultadosAPI();
    console.log("Almacenando resultados en caché (Local Storage)");
    localStorage.setItem("resultados", JSON.stringify(resultados));
    localStorage.setItem("horaResultados", ahora.getTime());
  }
  console.log("Obtención definitiva de resultados del Backend:");
  return resultados;
}

// función que recupera los resultados desde la caché de Local Storage
function obtenerResultadosCache() {
  const cache = new Date(parseInt(localStorage.getItem("horaResultados")));
  console.log(
    `Hora de caché de datos: ${cache.getHours()}:${String(
      cache.getMinutes()
    ).padStart(2, "0")}`
  );
  const min5 = 1000 * 60 * 5;
  const tiempo = (ahora.getTime() - cache.getTime()) / 60000;
  function redondearDecimal(numero, decimales) {
    let factor = Math.pow(10, decimales);
    return Math.round(numero * factor) / factor;
  }
  console.log(
    `tiempo transcurrido desde última actualización: ${redondearDecimal(
      tiempo,
      2
    )} minutos`
  );

  // si no han pasado más de 5min, se recuperan los datos de la caché(local storage)
  if (ahora.getTime() - cache.getTime() < min5) {
    console.log("Recuperando resultados de caché (localStorage)");
    return JSON.parse(localStorage.getItem("resultados"));
  } else {
    // Ya han pasado más de 5min, solicitar datos de la API
    return false;
  }
}

// Proceso 5: A partir de los resultados, insertarlos adecuadamente en la parte visual de la aplicación

function mostrarResultados() {
  const pAct = document.querySelectorAll(".precioAct");
  if (datosResultados && pAct.length === datosResultados.length) {
    pAct.forEach((p, index) => {
      p.textContent = `${datosResultados[index].coste} €/wh`;
    });
  } else {
    console.log("No se pudieron actualizar los precios en los elementos <p>.");
  }
  const pMax = document.querySelectorAll(".precioMax");
  pMax.forEach((p, index) => {
    p.textContent = `${datosResultados[index].max} €/wh de ${datosResultados[index].hora_max}h`;
  });
  const pMin = document.querySelectorAll(".precioMin");
  pMin.forEach((p, index) => {
    p.textContent = `${datosResultados[index].min} €/wh de ${datosResultados[index].hora_min}h`;
  });
}

// Reloj en pantalla

function actualizarFechaYHora() {
  const pFechaActual = document.querySelector(".fecha");
  if (pFechaActual) {
    const ahora = new Date();
    const fechaHoraTexto = `Fecha actual: ${ahora.toLocaleString()}`;
    pFechaActual.textContent = fechaHoraTexto;
  }
}
setInterval(actualizarFechaYHora, 1000);
actualizarFechaYHora();
