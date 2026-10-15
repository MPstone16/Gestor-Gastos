import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Category, CATEGORIES, CATEGORY_ICONS, Expense } from '@/types/expense';
import { LiquidGlassColors, Spacing } from '@/constants/theme';
import { useExpenses } from '@/context/ExpenseContext';
import { deleteStoredReceipt, saveReceipt } from '@/database/receiptStorage';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

function getAmountError(value: string): string | undefined {
  if (!value) return 'El monto es obligatorio.';
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) {
    return 'Ingresa solo números y hasta dos decimales.';
  }

  const parsedAmount = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return 'El monto debe ser mayor que cero.';
  }

  return undefined;
}

function getDescriptionError(value: string): string | undefined {
  if (value.length > 400) return 'La descripción no puede superar 400 caracteres.';
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]*$/.test(value)) {
    return 'Usa solo letras, números y espacios.';
  }

  return undefined;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  onClose,
  expense,
}) => {
  const { addExpense, updateExpense } = useExpenses();
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState<Category | null>(expense?.category ?? null);
  const [description, setDescription] = useState(expense?.description ?? '');
  const [date, setDate] = useState(expense ? new Date(expense.date) : new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | undefined>(expense?.receiptUri);
  const [receiptChanged, setReceiptChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [amountError, setAmountError] = useState<string>();
  const [categoryError, setCategoryError] = useState<string>();
  const [descriptionError, setDescriptionError] = useState<string>();

  const resetForm = () => {
    setAmount('');
    setCategory(null);
    setDescription('');
    setDate(new Date());
    setDatePickerVisible(false);
    setReceiptUri(undefined);
    setReceiptChanged(false);
    setIsSaving(false);
    setAmountError(undefined);
    setCategoryError(undefined);
    setDescriptionError(undefined);
  };

  const selectReceipt = async (source: 'camera' | 'gallery') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permiso necesario',
          source === 'camera'
            ? 'Permite el acceso a la cámara en los ajustes para tomar una foto.'
            : 'Permite el acceso a tus fotos en los ajustes para elegir un comprobante.'
        );
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });

      if (result.canceled) {
        Alert.alert('Selección cancelada', 'No se seleccionó ningún comprobante.');
        return;
      }

      setReceiptUri(result.assets[0].uri);
      setReceiptChanged(true);
    } catch (error) {
      console.error('No se pudo seleccionar el comprobante', error);
      Alert.alert('Error', 'No se pudo abrir la cámara o la galería. Intenta de nuevo.');
    }
  };

  const handleSubmit = async () => {
    const nextAmountError = getAmountError(amount);
    const nextCategoryError = category ? undefined : 'Selecciona una categoría para continuar.';
    const nextDescriptionError = getDescriptionError(description);
    setAmountError(nextAmountError);
    setCategoryError(nextCategoryError);
    setDescriptionError(nextDescriptionError);

    if (nextAmountError || nextCategoryError || nextDescriptionError || !category) {
      return;
    }

    const parsedAmount = Number(amount.replace(',', '.'));
    if (Number.isNaN(date.getTime())) {
      Alert.alert('Fecha inválida', 'Selecciona una fecha válida para el gasto.');
      return;
    }

    setIsSaving(true);
    let newlySavedReceiptUri: string | undefined;
    try {
      let savedReceiptUri = receiptUri;
      if (receiptChanged && receiptUri) {
        newlySavedReceiptUri = await saveReceipt(receiptUri);
        savedReceiptUri = newlySavedReceiptUri;
      } else if (receiptChanged) {
        savedReceiptUri = undefined;
      }

      const expenseData = {
        amount: parsedAmount,
        category,
        date,
        description: description.trim() || undefined,
        receiptUri: savedReceiptUri,
      };

      if (expense) {
        await updateExpense({ ...expenseData, id: expense.id });
      } else {
        await addExpense(expenseData);
      }
    } catch (error) {
      console.error('Error al guardar los cambios del gasto', error);
      if (newlySavedReceiptUri) {
        try {
          await deleteStoredReceipt(newlySavedReceiptUri);
        } catch (cleanupError) {
          console.error('No se pudo limpiar el comprobante no guardado', cleanupError);
        }
      }
      Alert.alert('Error', 'No se pudo guardar el gasto. Tus datos siguen en el formulario.');
      setIsSaving(false);
      return;
    }

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={0}
      >
        {/* Tocar el fondo tambien cierra el modal */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View entering={FadeIn} style={styles.backdropBlur}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </TouchableOpacity>

        <Animated.View
          entering={SlideInDown.springify()}
          style={styles.modalContent}
        >
          <View style={styles.modalBackground}>
            <BlurView intensity={100} tint="light" style={styles.modalBlur}>
              <View style={styles.handleBar} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.title}>
                  {expense ? 'Editar gasto' : 'Agregar gasto'}
                </Text>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Monto (USD)</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.input}
                      value={amount}
                      onChangeText={(value) => {
                        setAmount(value);
                        setAmountError(value ? getAmountError(value) : undefined);
                      }}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={LiquidGlassColors.glassTextSecondary}
                      accessibilityLabel="Monto en dólares"
                      accessibilityHint={amountError}
                    />
                  </View>
                  {amountError && (
                    <Text style={styles.errorText} accessibilityRole="alert">
                      {amountError}
                    </Text>
                  )}
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Fecha del gasto *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setDatePickerVisible((isVisible) => !isVisible)}
                    accessibilityRole="button"
                    accessibilityLabel="Elegir fecha del gasto"
                  >
                    <Text style={styles.dateButtonText}>
                      {date.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.dateButtonIcon}>📅</Text>
                  </TouchableOpacity>
                  {datePickerVisible && (
                    <View style={styles.datePickerContainer}>
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (event.type === 'set' && selectedDate) setDate(selectedDate);
                          if (Platform.OS !== 'ios' || event.type !== 'set') {
                            setDatePickerVisible(false);
                          }
                        }}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.dateDoneButton}
                          onPress={() => setDatePickerVisible(false)}
                        >
                          <Text style={styles.dateDoneText}>Listo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Categoría</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoriesScroll}
                    contentContainerStyle={styles.categoriesContent}
                  >
                    {/* La elegida se pinta con el gradiente */}
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          setCategory(cat);
                          setCategoryError(undefined);
                        }}
                        style={[
                          styles.categoryButton,
                          category === cat && styles.categoryButtonActive,
                        ]}
                      >
                        {category === cat ? (
                          <LinearGradient
                            colors={[
                              LiquidGlassColors.primary,
                              LiquidGlassColors.secondary,
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.categoryGradient}
                          >
                            <Text style={styles.categoryIcon}>
                              {CATEGORY_ICONS[cat]}
                            </Text>
                            <Text style={styles.categoryTextActive}>{cat}</Text>
                          </LinearGradient>
                        ) : (
                          <>
                            <Text style={styles.categoryIcon}>
                              {CATEGORY_ICONS[cat]}
                            </Text>
                            <Text style={styles.categoryText}>{cat}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {categoryError && (
                    <Text style={styles.errorText} accessibilityRole="alert">
                      {categoryError}
                    </Text>
                  )}
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Comprobante (opcional)</Text>
                  {receiptUri ? (
                    <View style={styles.receiptPreviewContainer}>
                      <Image source={{ uri: receiptUri }} style={styles.receiptPreview} />
                      <TouchableOpacity
                        style={styles.removeReceiptButton}
                        onPress={() => {
                          setReceiptUri(undefined);
                          setReceiptChanged(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar comprobante"
                      >
                        <Text style={styles.removeReceiptText}>Quitar comprobante</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.receiptActions}>
                      <TouchableOpacity
                        style={styles.receiptButton}
                        onPress={() => selectReceipt('camera')}
                        accessibilityRole="button"
                      >
                        <Text style={styles.receiptButtonText}>Tomar foto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.receiptButton}
                        onPress={() => selectReceipt('gallery')}
                        accessibilityRole="button"
                      >
                        <Text style={styles.receiptButtonText}>Elegir imagen</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Descripción (opcional)</Text>
                  <TextInput
                    style={[styles.input, styles.descriptionInput]}
                    value={description}
                    onChangeText={(value) => {
                      setDescription(value);
                      setDescriptionError(getDescriptionError(value));
                    }}
                    placeholder="Ej: Almuerzo, transporte a la universidad..."
                    placeholderTextColor={LiquidGlassColors.glassTextSecondary}
                    maxLength={400}
                    multiline
                    accessibilityLabel="Descripción opcional, máximo 400 caracteres"
                    accessibilityHint={descriptionError}
                  />
                  {descriptionError && (
                    <Text style={styles.errorText} accessibilityRole="alert">
                      {descriptionError}
                    </Text>
                  )}
                  <Text style={styles.characterCount}>{description.length}/400</Text>
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      isSaving && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={isSaving}
                  >
                    <LinearGradient
                      colors={[LiquidGlassColors.primary, LiquidGlassColors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.submitGradient}
                    >
                      <Text style={styles.submitButtonText}>
                        {isSaving
                          ? 'Guardando...'
                          : expense
                            ? 'Guardar cambios'
                            : 'Agregar'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </BlurView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropBlur: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalBackground: {
    // Bajito a proposito: si es casi opaco no se ve el blur del fondo
    backgroundColor: LiquidGlassColors.glassPanelBackground,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  modalBlur: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    maxHeight: '100%',
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: LiquidGlassColors.glassTextSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.three,
    marginTop: Spacing.two,
    opacity: 0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: LiquidGlassColors.glassText,
    marginBottom: Spacing.four,
  },
  inputSection: {
    marginBottom: Spacing.four,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: LiquidGlassColors.glassText,
    marginBottom: Spacing.two,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    paddingHorizontal: Spacing.three,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: LiquidGlassColors.primary,
    marginRight: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: LiquidGlassColors.glassText,
    paddingVertical: Spacing.three,
  },
  errorText: {
    color: LiquidGlassColors.secondary,
    fontSize: 12,
    marginTop: Spacing.one,
  },
  characterCount: {
    color: LiquidGlassColors.glassTextSecondary,
    fontSize: 12,
    textAlign: 'right',
    marginTop: Spacing.one,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dateButtonText: {
    fontSize: 16,
    color: LiquidGlassColors.glassText,
  },
  dateButtonIcon: {
    fontSize: 20,
  },
  datePickerContainer: {
    marginTop: Spacing.two,
    alignItems: 'center',
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    padding: Spacing.two,
  },
  dateDoneText: {
    color: LiquidGlassColors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionInput: {
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    paddingHorizontal: Spacing.three,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoriesScroll: {
    marginHorizontal: -Spacing.two,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  categoryButton: {
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    padding: Spacing.two,
    minWidth: 100,
    alignItems: 'center',
  },
  categoryButtonActive: {
    borderColor: 'transparent',
  },
  categoryGradient: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    width: '100%',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: Spacing.one,
  },
  categoryText: {
    fontSize: 12,
    color: LiquidGlassColors.glassText,
    textAlign: 'center',
  },
  categoryTextActive: {
    fontSize: 12,
    color: LiquidGlassColors.glassTextLight,
    fontWeight: '600',
    textAlign: 'center',
  },
  receiptActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  receiptButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    paddingVertical: Spacing.three,
  },
  receiptButtonText: {
    color: LiquidGlassColors.glassText,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptPreviewContainer: {
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  receiptPreview: {
    width: 120,
    height: 120,
    borderRadius: Spacing.two,
    backgroundColor: LiquidGlassColors.glassInputBackground,
  },
  removeReceiptButton: {
    paddingVertical: Spacing.one,
  },
  removeReceiptText: {
    color: LiquidGlassColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: LiquidGlassColors.glassInputBackground,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: LiquidGlassColors.glassBorder,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: LiquidGlassColors.glassText,
  },
  submitButton: {
    flex: 1,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: LiquidGlassColors.glassTextLight,
  },
});
