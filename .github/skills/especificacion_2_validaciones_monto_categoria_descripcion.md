# Especificación 2: Validaciones de monto, categoría y descripción

## 1. Objetivo

Validar los campos del formulario de gastos para evitar registros
incompletos o con datos no permitidos. La implementación debe mantener
Expo, React Native, TypeScript, SQLite y el diseño Liquid Glass del
proyecto.

El formulario actual se encuentra en
`src/components/AddExpenseModal.tsx`. El modelo está en
`src/types/expense.ts`, y la persistencia se realiza mediante
`src/context/ExpenseContext.tsx` y `src/database/expenseRepository.ts`.

## 2. Reglas de validación

### 2.1 Monto obligatorio: solo números y hasta dos decimales

-   El monto es obligatorio; no permitir guardar si está vacío.
-   Aceptar dígitos y un separador decimal, con un máximo de dos cifras
    decimales.
-   Permitir valores como `12`, `12.5` y `12.50`. Si la interfaz admite
    coma decimal, normalizarla de forma explícita antes de convertir a
    número; no mezclar separadores ambiguamente.
-   Rechazar letras, signos, espacios internos y más de dos decimales.
-   Rechazar cero y valores negativos si el objetivo es registrar gastos
    positivos.
-   Validar tanto mientras se escribe como al guardar.
    `keyboardType="decimal-pad"` ayuda a la entrada, pero no es una
    validación suficiente.
-   Al persistir, convertir el valor validado a número y comprobar que
    sea finito.

**Regla sugerida:** `^\d+([.,]\d{1,2})?$` para validar el texto de
entrada si se decide aceptar tanto punto como coma. Antes de
`parseFloat`, normalizar la coma a punto. Si solo se aceptará punto
decimal, usar `^\d+(\.\d{1,2})?$`. La expresión elegida debe coincidir
con el comportamiento real de la interfaz.

### 2.2 Categoría obligatoria con mensaje de error

-   La categoría es obligatoria.
-   Si el usuario intenta guardar sin seleccionar una categoría, mostrar
    un mensaje visible y claro, por ejemplo: **"Selecciona una categoría
    para continuar."**
-   No basta con deshabilitar el botón: la validación de envío debe
    informar qué falta.
-   Mantener la categoría elegida cuando ocurra un error en otro campo
    para evitar que el usuario tenga que volver a seleccionarla.
-   La regla aplica tanto al crear como al editar un gasto.

### 2.3 Descripción opcional, máximo 400 caracteres y sin caracteres especiales

-   La descripción es opcional; se puede guardar vacía.
-   Limitar la longitud a 400 caracteres.
-   Permitir letras del alfabeto español (incluidas `áéíóú`, `ü` y `ñ`)
    y números.
-   Para cumplir literalmente "solo letras y números", no admitir
    puntuación ni símbolos especiales. Los espacios pueden permitirse
    para que una descripción contenga varias palabras; esta decisión
    debe aplicarse consistentemente.
-   No aceptar saltos de línea si se establece una descripción de una
    sola línea.
-   Validar durante la escritura y de nuevo al guardar.
-   Si se ingresan caracteres no permitidos, se puede rechazarlos
    inmediatamente o mostrar un mensaje y no permitir el envío. Elegir
    un comportamiento coherente y comunicarlo al usuario.
-   Mostrar un contador opcional, por ejemplo `120/400`.

**Regla sugerida:** `/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]{0,400}$/`. Esta
expresión permite letras latinas, vocales acentuadas en español, `ü`,
`ñ`, números y espacios; excluye signos de puntuación y otros símbolos.
Si se necesitan letras de otros alfabetos, ampliar la regla
deliberadamente en vez de permitir todos los símbolos de forma
accidental.

## 3. Archivos que se deben modificar

### `src/components/AddExpenseModal.tsx`

Es el lugar principal para estas reglas.

**Monto** - Mantener el estado de entrada como texto (`string`) porque
`TextInput` entrega texto. - Implementar una función de validación del
monto y aplicarla en `onChangeText` y en `handleSubmit`. - No confiar
únicamente en `keyboardType="decimal-pad"`. - Mostrar un mensaje de
validación junto al campo cuando el valor sea inválido. - En el envío,
comprobar que el monto cumple la regla antes de convertirlo a número. -
Usar el mismo comportamiento en modo creación y edición, si el
formulario se amplía para editar.

**Categoría** - Revisar `handleSubmit`: actualmente el formulario
retorna silenciosamente si falta `amount` o `category`. - Sustituir ese
retorno silencioso por validaciones que actualicen los errores
visibles. - Si no hay categoría, mostrar "Selecciona una categoría para
continuar." - No iniciar la operación de guardado mientras existan
errores.

**Descripción** - Añadir `maxLength={400}` al `TextInput`. - Validar los
caracteres con una función o expresión regular. - Permitir la cadena
vacía porque el campo es opcional. - Mostrar un mensaje breve si hay
caracteres no permitidos. - Considerar quitar `multiline` si no se
quieren admitir saltos de línea; si se conserva, bloquear o validar
explícitamente los saltos de línea. - Mantener el texto del campo si el
formulario presenta un error para que el usuario pueda corregirlo.

**Presentación de errores** - Crear estilos para mensajes de error
usando `StyleSheet` y los colores del tema (`LiquidGlassColors`). -
Mantener el diseño Liquid Glass y la estructura actual con
`KeyboardAvoidingView` y `ScrollView`. - Comprobar que los mensajes no
queden tapados por el teclado ni desplacen de forma confusa los botones.

### `src/types/expense.ts`

**Qué cambiar:** no es necesario cambiar el tipo `amount: number` ni
`description?: string` para expresar estas reglas. Las restricciones de
caracteres y longitud pertenecen a la validación del formulario. Se
pueden definir funciones o tipos auxiliares si ayudan a reutilizar las
reglas, pero no duplicar la validación en muchos lugares.

### `src/context/ExpenseContext.tsx`

**Qué cambiar:** mantener la operación `addExpense` como una función que
recibe un gasto validado. No reemplazar la validación visual del
formulario por una validación exclusiva en el contexto. Si otros
componentes también pueden crear o actualizar gastos, aplicar una
comprobación de integridad compartida antes de persistir.

### `src/database/expenseRepository.ts`

**Qué cambiar:** conservar `amount` como valor numérico y `description`
como texto nullable. La base de datos no sustituye las validaciones de
la interfaz. Como defensa adicional, verificar los datos en la capa de
lógica antes de llamar al repositorio; si se incorporan restricciones
SQL, hacerlo mediante una migración compatible con los registros
existentes.

### `src/app/index.tsx`

**Qué cambiar:** no requiere cambios para las reglas de validación si el
formulario continúa siendo el único punto de entrada. Solo modificarlo
si se decide mostrar un resumen global de errores o si desde la pantalla
se permite guardar/editar datos por otro mecanismo.

## 4. Flujo esperado al guardar

1.  Comprobar que el monto no esté vacío.
2.  Comprobar que el monto cumpla el formato numérico elegido y tenga
    como máximo dos decimales.
3.  Comprobar que el monto sea finito y mayor que cero.
4.  Comprobar que se haya seleccionado una categoría.
5.  Comprobar que la descripción tenga como máximo 400 caracteres y
    cumpla la regla de caracteres permitidos.
6.  Si existe algún error, mostrar el mensaje correspondiente y no
    guardar.
7.  Si todo es válido, convertir el monto a número y ejecutar la
    operación de persistencia.
8.  Cerrar y limpiar el formulario solo después de que el guardado
    termine correctamente.

## 5. Criterios de aceptación

-   [ ] No se puede guardar el gasto con el monto vacío.
-   [ ] Se aceptan montos como `12`, `12.5` y `12.50`.
-   [ ] Se rechazan letras, valores negativos, cero y montos con más de
    dos decimales.
-   [ ] La categoría es obligatoria y se muestra un mensaje si falta.
-   [ ] La descripción se puede dejar vacía.
-   [ ] La descripción admite letras del alfabeto español, números y
    espacios, según la regla definida.
-   [ ] La descripción no supera 400 caracteres.
-   [ ] Los signos de puntuación y símbolos no permitidos se rechazan.
-   [ ] Los errores se muestran junto al campo correspondiente y se
    pueden corregir.
-   [ ] Si la validación falla, no se escribe ningún registro en SQLite.
-   [ ] Las reglas se aplican también al editar un gasto.

## 6. Casos de prueba

  Campo         Entrada                     Resultado esperado
  ------------- --------------------------- --------------------------------
  Monto         vacío                       Error: el monto es obligatorio
  Monto         `12`                        Válido
  Monto         `12.5`                      Válido
  Monto         `12.50`                     Válido
  Monto         `12.567`                    Inválido: más de dos decimales
  Monto         `abc`                       Inválido
  Monto         `-4.00`                     Inválido
  Monto         `0.00`                      Inválido
  Categoría     ninguna seleccionada        Mostrar mensaje y no guardar
  Descripción   vacía                       Válida
  Descripción   `Almuerzo 2`                Válida
  Descripción   400 caracteres permitidos   Válida
  Descripción   401 caracteres              Inválida / limitada a 400
  Descripción   `Almuerzo!`                 Inválida por el signo `!`
  Descripción   `café y transporte`         Válida
