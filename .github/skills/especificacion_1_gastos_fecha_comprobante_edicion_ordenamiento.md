# Especificación 1: Fecha, comprobante, edición, eliminación y ordenamiento de gastos

## 1. Objetivo

Ampliar el registro y la administración de gastos de la aplicación
**Gestor de Gastos para Poliestudiantes**, desarrollada con Expo, React
Native, TypeScript y SQLite. Los cambios deben conservar el diseño
Liquid Glass existente y la persistencia local.

Esta especificación se basa en la estructura actual del proyecto. Los
archivos principales identificados son
`src/components/AddExpenseModal.tsx`, `src/components/ExpenseItem.tsx`,
`src/app/index.tsx`, `src/context/ExpenseContext.tsx`,
`src/database/database.ts`, `src/database/expenseRepository.ts` y
`src/types/expense.ts`.

## 2. Requerimientos funcionales

### 2.1 Fecha obligatoria del gasto

-   Añadir al formulario un campo **Fecha del gasto**, obligatorio.
-   Al crear un gasto, la fecha puede iniciar con el día actual como
    valor predeterminado, pero el usuario debe poder revisarla y
    cambiarla antes de guardar.
-   Guardar la fecha seleccionada, no reemplazarla automáticamente por
    `new Date()` al enviar el formulario.
-   Validar que exista una fecha válida antes de permitir guardar.
-   Mostrar la fecha registrada en el elemento del gasto y mantenerla
    disponible para consultas y ordenamiento.
-   Al editar un gasto, mostrar la fecha que ya tenía guardada.

**Comportamiento de interfaz:** usar un selector de fecha compatible con
Expo/React Native. Antes de agregar una dependencia, comprobar su
compatibilidad con la versión de Expo del proyecto. Mantener el selector
dentro del modal y respetar `KeyboardAvoidingView`, `ScrollView` y el
estilo Liquid Glass.

### 2.2 Comprobante o factura opcional

-   Añadir el campo `factura_adjuntar`, opcional, para guardar la
    referencia local al comprobante.
-   Permitir dos formas de selección: abrir la cámara para tomar una
    foto y seleccionar una imagen existente de la galería.
-   Usar `expo-image-picker`. Instalar la versión compatible con el SDK
    del proyecto mediante `npx expo install expo-image-picker`.
-   Solicitar los permisos necesarios en el momento de uso y mostrar un
    mensaje claro si el permiso se deniega o el usuario cancela.
-   Mostrar una vista previa de la imagen seleccionada y una acción para
    quitarla antes de guardar.
-   No exigir comprobante para registrar un gasto.
-   Si el gasto ya tiene comprobante, mostrarlo al editarlo y permitir
    reemplazarlo o quitarlo.
-   Guardar la URI o ruta que devuelva Image Picker, sin convertirla en
    una URL remota inventada. Considerar que una URI temporal puede
    dejar de estar disponible; si se necesita garantizar la conservación
    a largo plazo, copiar el archivo a almacenamiento persistente de la
    aplicación y guardar la URI resultante.
-   Si no hay comprobante, guardar `NULL` en SQLite y representar la
    propiedad como opcional en TypeScript.

### 2.3 Editar un gasto existente

-   Añadir una acción **Editar** para cada gasto.
-   Reutilizar el formulario de `AddExpenseModal.tsx` para crear y
    editar, por ejemplo, ampliándolo para recibir el gasto que se va a
    editar y el modo de operación.
-   Al abrir la edición, precargar monto, categoría, fecha, descripción
    y comprobante.
-   Al guardar cambios, actualizar el registro existente por su `id`; no
    insertar un gasto duplicado.
-   Actualizar el estado del contexto después de que la operación SQLite
    finalice correctamente.
-   Mostrar un mensaje de error si falla la actualización y conservar
    los datos del formulario para que el usuario pueda intentarlo de
    nuevo.

### 2.4 Eliminar un gasto

-   Añadir una acción **Eliminar** en cada elemento.
-   Antes de eliminar, solicitar confirmación para evitar borrados
    accidentales.
-   Eliminar por `id` de SQLite y, solo después de una operación
    exitosa, retirar el elemento de la lista en pantalla.
-   Si el gasto tiene una imagen guardada en el almacenamiento local de
    la app, definir una limpieza segura del archivo al eliminarlo. No
    borrar archivos que no pertenezcan a la aplicación.
-   Mostrar un mensaje si ocurre un error.

### 2.5 Ordenar por los gastos más altos

-   Añadir un control visible para ordenar la lista por **Monto: mayor a
    menor**.
-   El orden debe aplicarse a los gastos que se muestran en la pantalla
    principal. Si la pantalla sigue mostrando solo los gastos del mes
    actual, ordenar esa lista mensual; no cambiar silenciosamente el
    alcance del filtro.
-   Usar una copia del arreglo para ordenar y no modificar directamente
    el estado original.
-   Comparar valores numéricos (`amount`) en orden descendente.
-   Si se añade una opción para volver al orden habitual, conservar el
    comportamiento actual de mostrar primero los gastos más recientes.

## 3. Archivos que se deben modificar

### `src/types/expense.ts`

**Qué cambiar:** ampliar `Expense` con una propiedad opcional para la
factura, por ejemplo `receiptUri?: string` (o
`facturaAdjuntar?: string`, eligiendo un único nombre y usándolo
consistentemente).

**Por qué:** el tipo describe los datos que la aplicación maneja. La
fecha ya existe como `date: Date`; no se debe crear otra fecha paralela
para el mismo propósito.

### `src/database/database.ts`

**Qué cambiar:** añadir una columna nullable para el comprobante, por
ejemplo `receipt_uri TEXT`, a la tabla `expenses`.

**Importante:** la base se crea con `CREATE TABLE IF NOT EXISTS`. Esa
sentencia no añade columnas a una tabla que ya existe. Implementar una
migración segura con `PRAGMA table_info(expenses)` y
`ALTER TABLE ... ADD COLUMN` cuando la columna todavía no exista. Evitar
borrar la base de datos, porque se perderían gastos registrados.

### `src/database/expenseRepository.ts`

**Qué cambiar:** - Incluir la nueva columna en `ExpenseRow`, `SELECT` e
`INSERT`. - Convertir la fila SQLite a `Expense` incluyendo la URI
opcional. - Añadir funciones de actualización y eliminación por `id`. -
Mantener la conversión de fecha entre el valor ISO guardado y `Date`.

**Por qué:** este archivo concentra el acceso a SQLite y evita dispersar
consultas SQL por los componentes.

### `src/context/ExpenseContext.tsx`

**Qué cambiar:** - Ampliar la interfaz del contexto con funciones
asíncronas para actualizar y eliminar gastos. - Invocar las funciones
del repositorio y actualizar `expenses` únicamente cuando SQLite
confirme la operación. - Mantener `getCurrentMonthExpenses()` y
`getMonthlyTotal()` coherentes después de crear, editar o eliminar. -
Exponer la lista ordenada desde la pantalla o aplicar el orden en
`index.tsx`, sin alterar el arreglo de estado original.

**Por qué:** el contexto es la capa compartida entre la interfaz y la
base de datos.

### `src/components/AddExpenseModal.tsx`

**Qué cambiar:** - Incorporar el selector de fecha obligatorio. -
Incorporar las opciones de cámara y galería con `expo-image-picker`. -
Mostrar la vista previa y la opción de quitar o cambiar el
comprobante. - Admitir modo crear y modo editar, con los campos
precargados cuando corresponda. - Validar la fecha y conservar el
comprobante actual si el usuario no decide cambiarlo. - Cambiar el texto
del título y botón según el modo (por ejemplo, "Agregar gasto" /
"Guardar cambios").

**Por qué:** este componente ya contiene el formulario y la lógica de
envío del gasto, por lo que es el punto central para ampliar el
registro.

### `src/components/ExpenseItem.tsx`

**Qué cambiar:** - Añadir acciones accesibles para editar y eliminar. -
Mostrar la fecha guardada. - Si es útil para la interfaz, indicar
visualmente que el gasto tiene comprobante adjunto; la vista previa
completa puede mostrarse al abrir la edición o una pantalla de detalle.

**Por qué:** este componente representa cada gasto de la lista.

### `src/app/index.tsx`

**Qué cambiar:** - Añadir el control de ordenamiento por monto
descendente. - Pasar a cada elemento las acciones de editar y eliminar,
o conectar dichas acciones mediante el contexto. - Controlar la apertura
del formulario en modo crear o editar. - Conservar la pantalla de carga,
el estado vacío, el encabezado mensual y el botón flotante de agregar.

**Por qué:** es la pantalla que muestra la lista y actualmente obtiene
los gastos del mes desde `useExpenses()`.

### `package.json` y `app.json` (si corresponde)

**Qué cambiar:** instalar `expo-image-picker` con
`npx expo install expo-image-picker` y revisar la configuración/permisos
de plataforma que requiera la versión instalada. No añadir
configuraciones manuales que la versión de Expo ya gestione
automáticamente.

## 4. Criterios de aceptación

-   [ ] La fecha se puede elegir y no se permite guardar sin una fecha
    válida.
-   [ ] El gasto conserva la fecha elegida al cerrar y volver a abrir la
    aplicación.
-   [ ] El usuario puede tomar una foto o elegir una imagen de la
    galería.
-   [ ] El comprobante es opcional y puede verse, reemplazarse o
    quitarse al editar.
-   [ ] Editar actualiza el mismo gasto y no crea un duplicado.
-   [ ] Eliminar pide confirmación y elimina el registro persistido.
-   [ ] Ordenar por monto muestra primero el gasto de mayor valor.
-   [ ] Crear, editar y eliminar actualizan correctamente la lista y el
    total mensual.
-   [ ] Los gastos existentes siguen disponibles después de la migración
    SQLite.
-   [ ] Los cambios mantienen el diseño Liquid Glass y el comportamiento
    del teclado.

## 5. Pruebas recomendadas

1.  Crear un gasto con fecha de hoy y sin comprobante.
2.  Crear un gasto con fecha anterior y una foto tomada con la cámara.
3.  Crear un gasto seleccionando una imagen de la galería.
4.  Cerrar y volver a abrir la aplicación y comprobar que los datos se
    conservan.
5.  Editar fecha, monto y comprobante de un gasto existente.
6.  Quitar el comprobante durante la edición.
7.  Cancelar una eliminación y comprobar que el gasto permanece.
8.  Confirmar una eliminación y comprobar que desaparece también tras
    reiniciar la aplicación.
9.  Ordenar gastos con montos distintos y comprobar que el mayor aparece
    primero.
10. Comprobar el total mensual después de editar y eliminar.
