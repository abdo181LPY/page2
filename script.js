// ثوابت النظام
const DOLLAR_RATE = 1300; // سعر صرف الدولار
const DELIVERY_BAGHDAD = 6000; // تكلفة التوصيل في بغداد
const DELIVERY_PROVINCES = 7000; // تكلفة التوصيل للمحافظات

// رابط Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycby_b4BGf1DiTA36xXZh1uMwwon4AXrHidVSlbbFwTdEfkWG6AJ9aHcyhfY_xJJyqdxw/exec';

// بيانات محلية
let currentUser = null;
let pages = [];
let blockedNumbers = [];
let invoices = [];
let deletedInvoices = [];
let users = [];
let userIP = '';

// بداية التطبيق
document.addEventListener('DOMContentLoaded', function() {
    // جلب عنوان IP الخاص بالمستخدم
    getIP();
    
    // إعداد أحداث النقر للأزرار الرئيسية
    document.getElementById('calculateBtn').addEventListener('click', showCalculateForm);
    document.getElementById('orderBtn').addEventListener('click', showOrderForm);
    document.getElementById('searchBtn').addEventListener('click', showSearchForm);
    document.getElementById('adminBtn').addEventListener('click', showAdminPanel);
    
    document.getElementById('cancelCalculate').addEventListener('click', hideCalculateForm);
    document.getElementById('cancelOrder').addEventListener('click', hideOrderForm);
    document.getElementById('cancelSearch').addEventListener('click', hideSearchForm);
    
    document.getElementById('copyCostResult').addEventListener('click', copyCostResult);
    document.getElementById('copyOrderResult').addEventListener('click', copyOrderResult);
    
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // أحداث الإدارة
    document.getElementById('addUserBtn').addEventListener('click', () => showAdminForm('addUserForm'));
    document.getElementById('addBlockedNumberBtn').addEventListener('click', () => showAdminForm('addBlockedNumberForm'));
    document.getElementById('addPageBtn').addEventListener('click', () => showAdminForm('addPageForm'));
    document.getElementById('restoreInvoiceBtn').addEventListener('click', () => showAdminForm('restoreInvoiceForm'));
    document.getElementById('addBasketBtn').addEventListener('click', () => showAdminForm('addBasketForm'));
    document.getElementById('statisticsBtn').addEventListener('click', () => showAdminForm('statisticsForm'));
    document.getElementById('permissionsBtn').addEventListener('click', () => showAdminForm('permissionsForm'));
    document.getElementById('statusBtn').addEventListener('click', () => showAdminForm('statusForm'));
    
    // معالجة نماذج النظام
    document.getElementById('costCalculationForm').addEventListener('submit', calculateCost);
    document.getElementById('newOrderForm').addEventListener('submit', submitOrder);
    document.getElementById('invoiceSearchForm').addEventListener('submit', searchInvoices);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // معالجة نماذج الإدارة
    document.getElementById('newUserForm').addEventListener('submit', addUser);
    document.getElementById('newBlockedNumberForm').addEventListener('submit', addBlockedNumber);
    document.getElementById('newPageForm').addEventListener('submit', addPage);
    
    // تحميل البيانات الأولية
    loadInitialData();
});

// دالة لجلب عنوان IP الخاص بالمستخدم
function getIP() {
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            userIP = data.ip;
            console.log("IP Address: " + userIP);
        })
        .catch(error => {
            console.error('Error getting IP:', error);
            // استخدام عنوان IP افتراضي في حالة الفشل
            userIP = '0.0.0.0';
        });
}

// دالة لتحميل البيانات الأولية
function loadInitialData() {
    showLoading('جاري تحميل البيانات...');
    
    // تحميل المستخدمين
    fetchData('getUsers')
        .then(response => {
            if (response.success) {
                users = response.data;
                console.log('Users loaded:', users.length);
                return fetchData('getPages');
            } else {
                throw new Error('Failed to load users');
            }
        })
        .then(response => {
            if (response.success) {
                pages = response.data;
                console.log('Pages loaded:', pages.length);
                updatePagesList();
                return fetchData('getBlockedNumbers');
            } else {
                throw new Error('Failed to load pages');
            }
        })
        .then(response => {
            if (response.success) {
                blockedNumbers = response.data;
                console.log('Blocked numbers loaded:', blockedNumbers.length);
                hideLoading();
            } else {
                throw new Error('Failed to load blocked numbers');
            }
        })
        .catch(error => {
            console.error('Error loading initial data:', error);
            hideLoading();
            showMessage('فشل في تحميل البيانات الأولية. يرجى تحديث الصفحة وإعادة المحاولة.', 'error');
        });
}

// دالة لتحميل الفواتير
function loadInvoices() {
    showLoading('جاري تحميل الفواتير...');
    
    fetchData('getInvoices')
        .then(response => {
            if (response.success) {
                invoices = response.data;
                console.log('Invoices loaded:', invoices.length);
                hideLoading();
            } else {
                throw new Error('Failed to load invoices');
            }
        })
        .catch(error => {
            console.error('Error loading invoices:', error);
            hideLoading();
            showMessage('فشل في تحميل الفواتير. يرجى المحاولة مرة أخرى.', 'error');
        });
}

// دالة لتحميل الفواتير المحذوفة
function loadDeletedInvoices() {
    if (currentUser.permissionLevel < 3) return; // فقط المدراء يمكنهم رؤية الفواتير المحذوفة
    
    showLoading('جاري تحميل الفواتير المحذوفة...');
    
    fetchData('getDeletedInvoices')
        .then(response => {
            if (response.success) {
                deletedInvoices = response.data;
                console.log('Deleted invoices loaded:', deletedInvoices.length);
                hideLoading();
            } else {
                throw new Error('Failed to load deleted invoices');
            }
        })
        .catch(error => {
            console.error('Error loading deleted invoices:', error);
            hideLoading();
            showMessage('فشل في تحميل الفواتير المحذوفة. يرجى المحاولة مرة أخرى.', 'error');
        });
}

// دالة لإرسال طلب إلى Google Apps Script
function fetchData(action, data = {}) {
    const formData = new FormData();
    formData.append('action', action);
    
    // إضافة البيانات إلى formData
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            formData.append(key, data[key]);
        }
    }
    
    return fetch(API_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    });
}

// دالة لتحديث قائمة الصفحات في نموذج الحساب
function updatePagesList() {
    const pageSelect = document.getElementById('pageName');
    pageSelect.innerHTML = '<option value="">اختر الصفحة</option>';
    
    pages.forEach(page => {
        const option = document.createElement('option');
        option.value = page.id;
        option.textContent = page.name;
        pageSelect.appendChild(option);
    });
}

// دالة لمعالجة تسجيل الدخول
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('loginMessage');
    
    showLoading('جاري تسجيل الدخول...');
    
    fetchData('login', {
        username: username,
        password: password,
        ip: userIP
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            currentUser = response.data;
            
            // تحديث واجهة المستخدم
            document.getElementById('userDisplayName').textContent = `مرحباً، ${currentUser.fullName}`;
            
            // إظهار/إخفاء زر الإدارة بناءً على المستوى
            document.getElementById('adminCard').style.display = currentUser.permissionLevel === 3 ? 'block' : 'none';
            
            // إخفاء صفحة تسجيل الدخول وإظهار الصفحة الرئيسية
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainPage').style.display = 'block';
            
            // تحميل الفواتير بعد تسجيل الدخول
            loadInvoices();
            
            // تحميل الفواتير المحذوفة إذا كان المستخدم مدير
            if (currentUser.permissionLevel === 3) {
                loadDeletedInvoices();
            }
        } else {
            // عرض رسالة الخطأ
            if (response.error === 'ip_mismatch') {
                messageDiv.innerHTML = '<div class="alert alert-danger">عنوان IP الخاص بك غير مطابق. لا يمكن تسجيل الدخول من هذا الجهاز.</div>';
            } else {
                messageDiv.innerHTML = '<div class="alert alert-danger">اسم المستخدم أو كلمة المرور غير صحيحة</div>';
            }
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error during login:', error);
        messageDiv.innerHTML = '<div class="alert alert-danger">حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.</div>';
    });
}

// دالة لتسجيل الخروج
function logout() {
    currentUser = null;
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginMessage').innerHTML = '';
}

// دوال إظهار/إخفاء النماذج

function showCalculateForm() {
    hideAllForms();
    document.getElementById('calculateForm').style.display = 'block';
}

function hideCalculateForm() {
    document.getElementById('calculateForm').style.display = 'none';
}

function showOrderForm() {
    hideAllForms();
    document.getElementById('orderForm').style.display = 'block';
}

function hideOrderForm() {
    document.getElementById('orderForm').style.display = 'none';
}

function showSearchForm() {
    hideAllForms();
    document.getElementById('searchForm').style.display = 'block';
    document.getElementById('searchResults').style.display = 'none';
}

function hideSearchForm() {
    document.getElementById('searchForm').style.display = 'none';
}

function showAdminPanel() {
    hideAllForms();
    document.getElementById('adminPanel').style.display = 'block';
    hideAdminForms();
}

function showAdminForm(formId) {
    // إخفاء جميع نماذج الإدارة
    const adminForms = document.querySelectorAll('.admin-form');
    adminForms.forEach(form => {
        form.style.display = 'none';
    });
    
    // إظهار النموذج المطلوب
    document.getElementById(formId).style.display = 'block';
}

function hideAdminForms() {
    const adminForms = document.querySelectorAll('.admin-form');
    adminForms.forEach(form => {
        form.style.display = 'none';
    });
}

function hideAllForms() {
    document.getElementById('calculateForm').style.display = 'none';
    document.getElementById('orderForm').style.display = 'none';
    document.getElementById('searchForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('costResults').style.display = 'none';
    document.getElementById('orderResults').style.display = 'none';
}

// دالة لحساب التكلفة
function calculateCost(event) {
    event.preventDefault();
    
    const pageId = document.getElementById('pageName').value;
    const instagramLink = document.getElementById('instagramLink').value;
    const province = document.getElementById('province').value;
    const basketPrice = parseFloat(document.getElementById('basketPrice').value);
    const totalPieces = parseInt(document.getElementById('totalPieces').value);
    
    let totalCost = 0;
    
    // حساب التكلفة الأساسية بناءً على قواعد محددة
    if (basketPrice > 400) {
        totalCost = basketPrice * DOLLAR_RATE;
    } else if (basketPrice >= 200 && basketPrice <= 400) {
        totalCost = (basketPrice + (totalPieces * 0.25)) * DOLLAR_RATE;
    } else {
        totalCost = (basketPrice + (totalPieces * 0.5)) * DOLLAR_RATE;
    }
    
    // إضافة تكلفة التوصيل
    const deliveryCost = province === "بغداد" ? DELIVERY_BAGHDAD : DELIVERY_PROVINCES;
    const finalCost = Math.ceil(totalCost + deliveryCost);
    
    // حساب قيمة العربون
    let deposit = 0;
    if (finalCost > 70000) {
        if (basketPrice > 400) {
            deposit = finalCost * 0.5; // نصف المبلغ للطلبات فوق 400 دولار
        } else {
            deposit = finalCost * (Math.random() > 0.5 ? 0.33 : 0.25); // بين ربع وثلث المبلغ للطلبات العادية
        }
        
        // تقريب العربون لأقرب 5000 دينار للأعلى
        deposit = Math.ceil(deposit / 5000) * 5000;
    }
    
    // الحصول على اسم الصفحة
    const page = pages.find(p => p.id === pageId);
    const pageName = page ? page.name : '';
    
    // إعداد النص للعرض
    let resultText = `
مرحباً 👋
سعر طلبك من صفحة ${pageName} هو: ${finalCost.toLocaleString()} دينار عراقي
تفاصيل الطلب:
- سعر البضاعة: ${(basketPrice * DOLLAR_RATE).toLocaleString()} دينار
- عدد القطع: ${totalPieces} قطعة
- سعر الشحن: ${deliveryCost.toLocaleString()} دينار
- المحافظة: ${province}
- سعر الصرف: 1 دولار = ${DOLLAR_RATE} دينار

`;
    
    if (deposit > 0) {
        resultText += `العربون المطلوب: ${deposit.toLocaleString()} دينار عراقي
`;
    }
    
    resultText += `
يتم الدفع عند الاستلام
للطلب يرجى إرسال:
1. الاسم الثلاثي
2. رقم الهاتف
3. المحافظة والمنطقة
4. أقرب نقطة دالة

شكراً لاختيارك ${pageName} 🌹`;
    
    // عرض النتائج
    document.getElementById('costResultText').textContent = resultText;
    document.getElementById('costResults').style.display = 'block';
    
    // تخزين نتائج الحساب في قاعدة البيانات
    saveCalculation(pageId, instagramLink, province, basketPrice, totalPieces, finalCost, deposit);
    
    // إخفاء نموذج الحساب
    hideCalculateForm();
}

// دالة لتخزين نتائج الحساب
function saveCalculation(pageId, instagramLink, province, basketPrice, totalPieces, finalCost, deposit) {
    showLoading('جاري حفظ بيانات الحساب...');
    
    fetchData('saveCalculation', {
        userId: currentUser.id,
        pageId: pageId,
        instagramLink: instagramLink,
        province: province,
        basketPrice: basketPrice,
        totalPieces: totalPieces,
        finalCost: finalCost,
        deposit: deposit
    })
    .then(response => {
        hideLoading();
        if (!response.success) {
            showMessage('تم الحساب لكن هناك مشكلة في الحفظ', 'warning');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error saving calculation:', error);
        showMessage('حدث خطأ أثناء حفظ بيانات الحساب', 'error');
    });
}

// دالة لإرسال الطلب
function submitOrder(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const primaryPhone = document.getElementById('primaryPhone').value;
    const secondaryPhone = document.getElementById('secondaryPhone').value;
    const province = document.getElementById('orderProvince').value;
    const area = document.getElementById('area').value;
    const landmark = document.getElementById('landmark').value;
    const basketLink = document.getElementById('basketLink').value;
    const instagramLink = document.getElementById('orderInstagramLink').value;
    const totalPieces = document.getElementById('orderTotalPieces').value;
    const repeats = document.getElementById('repeats').value;
    const customPieces = document.getElementById('customPieces').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const depositAmount = document.getElementById('depositAmount').value;
    const notes = document.getElementById('notes').value;
    
    // التحقق من وجود الرقم في القائمة المحظورة
    const isBlocked = blockedNumbers.some(number => number.phoneNumber === primaryPhone);
    
    // إذا كان الرقم محظوراً، عرض رسالة تحذير
    if (isBlocked) {
        if (!confirm('هذا الرقم موجود في القائمة المحظورة. يجب دفع المبلغ كاملاً مقدماً. هل تريد المتابعة؟')) {
            return;
        }
    }
    
    showLoading('جاري تثبيت الطلب...');
    
    // إرسال البيانات إلى الخادم
    fetchData('submitOrder', {
        userId: currentUser.id,
        customerName: customerName,
        primaryPhone: primaryPhone,
        secondaryPhone: secondaryPhone,
        province: province,
        area: area,
        landmark: landmark,
        basketLink: basketLink,
        instagramLink: instagramLink,
        totalPieces: totalPieces,
        repeats: repeats,
        customPieces: customPieces,
        paymentMethod: paymentMethod,
        depositAmount: depositAmount,
        notes: notes,
        isBlocked: isBlocked
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            const invoice = response.data;
            
            // إضافة الفاتورة إلى البيانات المحلية
            invoices.push(invoice);
            
            // عرض تأكيد نجاح العملية
            showOrderConfirmation(invoice.id, customerName, primaryPhone, province);
            
            // إعادة تعيين النموذج
            document.getElementById('newOrderForm').reset();
        } else {
            showMessage('فشل في تثبيت الطلب: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error submitting order:', error);
        showMessage('حدث خطأ أثناء تثبيت الطلب. يرجى المحاولة مرة أخرى.', 'error');
    });
}

// دالة لعرض تأكيد الطلب
function showOrderConfirmation(invoiceId, customerName, phoneNumber, province) {
    // إنشاء نص تأكيد الطلب
    const confirmationText = `
تم تثبيت الطلب بنجاح!

رقم الفاتورة: ${invoiceId}
اسم الزبون: ${customerName}
رقم الهاتف: ${phoneNumber}
المحافظة: ${province}

تاريخ الطلب: ${new Date().toLocaleString('ar-EG')}

سيتم متابعة الطلب ومراجعته من قبل فريق العمل.
`;
    
    // عرض التأكيد
    document.getElementById('orderResultText').textContent = confirmationText;
    document.getElementById('orderResults').style.display = 'block';
    document.getElementById('orderForm').style.display = 'none';
}

// دالة البحث عن الفواتير
function searchInvoices(event) {
    event.preventDefault();
    
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const phoneNumber = document.getElementById('searchPhone').value;
    
    // التأكد من وجود معيار بحث واحد على الأقل
    if (!invoiceNumber && !phoneNumber) {
        showMessage('الرجاء إدخال رقم الفاتورة أو رقم الهاتف للبحث', 'warning');
        return;
    }
    
    showLoading('جاري البحث...');
    
    // إرسال طلب البحث إلى الخادم
    fetchData('searchInvoices', {
        invoiceNumber: invoiceNumber,
        phoneNumber: phoneNumber
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // عرض النتائج
            displaySearchResults(response.data);
        } else {
            showMessage('فشل في البحث: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error searching invoices:', error);
        showMessage('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.', 'error');
    });
}

// دالة لعرض نتائج البحث
function displaySearchResults(results) {
    const resultsTable = document.getElementById('searchResultsTable');
    resultsTable.innerHTML = '';
    
    if (results.length === 0) {
        // لا توجد نتائج
        resultsTable.innerHTML = '<tr><td colspan="6">لا توجد نتائج مطابقة</td></tr>';
    } else {
        // عرض النتائج
        results.forEach(invoice => {
            const tr = document.createElement('tr');
            
            // إنشاء خلايا الجدول
            const idCell = document.createElement('td');
            idCell.textContent = invoice.id;
            
            const nameCell = document.createElement('td');
            nameCell.textContent = invoice.customerName;
            
            const phoneCell = document.createElement('td');
            phoneCell.textContent = invoice.primaryPhone;
            
            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(invoice.createdAt).toLocaleString('ar-EG');
            
            const statusCell = document.createElement('td');
            statusCell.textContent = invoice.status;
            
            const actionsCell = document.createElement('td');
            
            // إضافة زر التفاصيل
            const detailsBtn = document.createElement('button');
            detailsBtn.textContent = 'التفاصيل';
            detailsBtn.className = 'btn btn-success';
            detailsBtn.style.marginRight = '5px';
            detailsBtn.style.width = 'auto';
            detailsBtn.onclick = () => showInvoiceDetails(invoice.id);
            
            actionsCell.appendChild(detailsBtn);
            
            // إضافة زر الحذف إذا كان لدى المستخدم الصلاحيات المناسبة
            if (canDeleteInvoice(invoice)) {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.className = 'btn btn-danger';
                deleteBtn.style.width = 'auto';
                deleteBtn.onclick = () => deleteInvoice(invoice.id);
                
                actionsCell.appendChild(deleteBtn);
            }
            
            // إضافة الخلايا إلى الصف
            tr.appendChild(idCell);
            tr.appendChild(nameCell);
            tr.appendChild(phoneCell);
            tr.appendChild(dateCell);
            tr.appendChild(statusCell);
            tr.appendChild(actionsCell);
            
            // إضافة الصف إلى الجدول
            resultsTable.appendChild(tr);
        });
    }
    
    // إظهار قسم النتائج
    document.getElementById('searchResults').style.display = 'block';
}

// دالة للتحقق من صلاحيات الحذف
function canDeleteInvoice(invoice) {
    if (!currentUser) return false;
    
    // المستوى الثالث يمكنه حذف أي فاتورة
    if (currentUser.permissionLevel === 3) return true;
    
    // المستوى الثاني يمكنه حذف أي فاتورة ما عدا التي تحتوي على رقم سلة
    if (currentUser.permissionLevel === 2) {
        return !invoice.basketId;
    }
    
    // المستوى الأول يمكنه حذف الفواتير التي أنشأها فقط
    if (currentUser.permissionLevel === 1) {
        return invoice.createdBy === currentUser.id;
    }
    
    return false;
}

// دالة لعرض تفاصيل الفاتورة
function showInvoiceDetails(invoiceId) {
    showLoading('جاري تحميل التفاصيل...');
    
    fetchData('getInvoiceDetails', { invoiceId: invoiceId })
        .then(response => {
            hideLoading();
            
            if (response.success) {
                const invoice = response.data;
                
                // إنشاء مربع حوار لعرض التفاصيل
                const dialog = document.createElement('div');
                dialog.className = 'invoice-dialog';
                
                const dialogContent = document.createElement('div');
                dialogContent.className = 'invoice-dialog-content';
                
                const closeBtn = document.createElement('span');
                closeBtn.className = 'invoice-dialog-close';
                closeBtn.innerHTML = '&times;';
                closeBtn.onclick = () => document.body.removeChild(dialog);
                
                const title = document.createElement('h3');
                title.textContent = `تفاصيل الفاتورة رقم: ${invoice.id}`;
                
                const content = document.createElement('div');
                content.className = 'invoice-details';
                content.innerHTML = `
                    <p><strong>الاسم:</strong> ${invoice.customerName}</p>
                    <p><strong>رقم الهاتف:</strong> ${invoice.primaryPhone}</p>
                    ${invoice.secondaryPhone ? `<p><strong>رقم الهاتف الثانوي:</strong> ${invoice.secondaryPhone}</p>` : ''}
                    <p><strong>المحافظة:</strong> ${invoice.province}</p>
                    <p><strong>المنطقة:</strong> ${invoice.area}</p>
                    <p><strong>أقرب نقطة دالة:</strong> ${invoice.landmark}</p>
                    <p><strong>رابط السلة:</strong> <a href="${invoice.basketLink}" target="_blank">${invoice.basketLink}</a></p>
                    <p><strong>رابط الإنستغرام:</strong> <a href="${invoice.instagramLink}" target="_blank">${invoice.instagramLink}</a></p>
                    <p><strong>عدد القطع:</strong> ${invoice.totalPieces}</p>
                    ${invoice.repeats ? `<p><strong>معلومات التكرارات:</strong> ${invoice.repeats}</p>` : ''}
                    ${invoice.customPieces ? `<p><strong>معلومات القطع المخصصة:</strong> ${invoice.customPieces}</p>` : ''}
                    <p><strong>طريقة الدفع:</strong> ${invoice.paymentMethod}</p>
                    <p><strong>مبلغ العربون:</strong> ${invoice.depositAmount}</p>
                    ${invoice.notes ? `<p><strong>ملاحظات:</strong> ${invoice.notes}</p>` : ''}
                    <p><strong>الحالة:</strong> ${invoice.status}</p>
                    <p><strong>تاريخ الإنشاء:</strong> ${new Date(invoice.createdAt).toLocaleString('ar-EG')}</p>
                    <p><strong>تم الإنشاء بواسطة:</strong> ${getUserName(invoice.createdBy)}</p>
                `;
                
                dialogContent.appendChild(closeBtn);
                dialogContent.appendChild(title);
                dialogContent.appendChild(content);
                dialog.appendChild(dialogContent);
                
                // إضافة أزرار إضافية (حسب الصلاحيات)
                if (canDeleteInvoice(invoice)) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-danger';
                    deleteBtn.textContent = 'حذف الفاتورة';
                    deleteBtn.onclick = () => {
                        document.body.removeChild(dialog);
                        deleteInvoice(invoice.id);
                    };
                    dialogContent.appendChild(deleteBtn);
                }
                
                if (currentUser.permissionLevel === 3) {
                    const statusBtn = document.createElement('button');
                    statusBtn.className = 'btn';
                    statusBtn.style.marginRight = '10px';
                    statusBtn.textContent = 'تغيير الحالة';
                    statusBtn.onclick = () => {
                        document.body.removeChild(dialog);
                        showChangeStatusForm(invoice.id);
                    };
                    dialogContent.appendChild(statusBtn);
                }
                
                document.body.appendChild(dialog);
            } else {
                showMessage('فشل في تحميل تفاصيل الفاتورة: ' + response.message, 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error fetching invoice details:', error);
            showMessage('حدث خطأ أثناء تحميل تفاصيل الفاتورة', 'error');
        });
}

// دالة للحصول على اسم المستخدم
function getUserName(userId) {
    const user = users.find(u => u.id === userId);
    return user ? user.fullName : 'غير معروف';
}

// دالة لحذف الفاتورة
function deleteInvoice(invoiceId) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
        return;
    }
    
    showLoading('جاري حذف الفاتورة...');
    
    fetchData('deleteInvoice', {
        invoiceId: invoiceId,
        userId: currentUser.id
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // تحديث البيانات المحلية
            const index = invoices.findIndex(inv => inv.id === invoiceId);
            if (index !== -1) {
                deletedInvoices.push(invoices[index]);
                invoices.splice(index, 1);
            }
            
            showMessage('تم حذف الفاتورة بنجاح', 'success');
            
            // إعادة تحميل نتائج البحث
            document.getElementById('invoiceSearchForm').dispatchEvent(new Event('submit'));
        } else {
            showMessage('فشل في حذف الفاتورة: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error deleting invoice:', error);
        showMessage('حدث خطأ أثناء حذف الفاتورة', 'error');
    });
}

// دالة لعرض نموذج تغيير الحالة
function showChangeStatusForm(invoiceId) {
    // إنشاء نموذج تغيير الحالة
    const dialog = document.createElement('div');
    dialog.className = 'invoice-dialog';
    
    const dialogContent = document.createElement('div');
    dialogContent.className = 'invoice-dialog-content';
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'invoice-dialog-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => document.body.removeChild(dialog);
    
    const title = document.createElement('h3');
    title.textContent = `تغيير حالة الفاتورة رقم: ${invoiceId}`;
    
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label class="form-label">الحالة الجديدة</label>
            <select class="form-select" id="newStatus" required>
                <option value="">اختر الحالة</option>
                <option value="جديد">جديد</option>
                <option value="ليث">ليث</option>
                <option value="الوسيط">الوسيط</option>
                <option value="لم يتم الشراء">لم يتم الشراء</option>
                <option value="تم الشراء">تم الشراء</option>
                <option value="الشحن">الشحن</option>
                <option value="مرتجع">مرتجع</option>
                <option value="مكتمل">مكتمل</option>
            </select>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" id="cancelStatusChange">إلغاء</button>
            <button type="submit" class="btn btn-success">تغيير الحالة</button>
        </div>
    `;
    
    dialogContent.appendChild(closeBtn);
    dialogContent.appendChild(title);
    dialogContent.appendChild(form);
    dialog.appendChild(dialogContent);
    
    document.body.appendChild(dialog);
    
    // معالجة إرسال النموذج
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const newStatus = document.getElementById('newStatus').value;
        if (!newStatus) {
            showMessage('الرجاء اختيار الحالة الجديدة', 'warning');
            return;
        }
        
        changeInvoiceStatus(invoiceId, newStatus, dialog);
    });
    
    // معالجة زر الإلغاء
    document.getElementById('cancelStatusChange').addEventListener('click', function() {
        document.body.removeChild(dialog);
    });
}

// دالة لتغيير حالة الفاتورة
function changeInvoiceStatus(invoiceId, newStatus, dialog) {
    showLoading('جاري تغيير الحالة...');
    
    fetchData('changeInvoiceStatus', {
        invoiceId: invoiceId,
        newStatus: newStatus,
        userId: currentUser.id
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // تحديث البيانات المحلية
            const invoice = invoices.find(inv => inv.id === invoiceId);
            if (invoice) {
                invoice.status = newStatus;
            }
            
            showMessage('تم تغيير حالة الفاتورة بنجاح', 'success');
            
            // إغلاق النموذج
            if (dialog) {
                document.body.removeChild(dialog);
            }
            
            // إعادة تحميل نتائج البحث إذا كانت ظاهرة
            if (document.getElementById('searchResults').style.display !== 'none') {
                document.getElementById('invoiceSearchForm').dispatchEvent(new Event('submit'));
            }
        } else {
            showMessage('فشل في تغيير حالة الفاتورة: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error changing invoice status:', error);
        showMessage('حدث خطأ أثناء تغيير حالة الفاتورة', 'error');
    });
}

// دوال الإدارة

// دالة لإضافة مستخدم جديد
function addUser(event) {
    event.preventDefault();
    
    // التحقق من صلاحيات المستخدم
    if (currentUser.permissionLevel !== 3) {
        showMessage('ليس لديك الصلاحيات الكافية لإضافة مستخدمين', 'error');
        return;
    }
    
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const fullName = document.getElementById('employeeName').value;
    const permissionLevel = document.getElementById('permissionLevel').value;
    
    showLoading('جاري إضافة المستخدم...');
    
    fetchData('addUser', {
        username: username,
        password: password,
        fullName: fullName,
        permissionLevel: permissionLevel
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // تحديث البيانات المحلية
            users.push(response.data);
            
            showMessage('تمت إضافة المستخدم بنجاح', 'success');
            
            // إعادة تعيين النموذج وإخفائه
            document.getElementById('newUserForm').reset();
            hideAdminForms();
        } else {
            showMessage('فشل في إضافة المستخدم: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error adding user:', error);
        showMessage('حدث خطأ أثناء إضافة المستخدم', 'error');
    });
}

// دالة لإضافة رقم محظور
function addBlockedNumber(event) {
    event.preventDefault();
    
    // التحقق من صلاحيات المستخدم
    if (currentUser.permissionLevel !== 3) {
        showMessage('ليس لديك الصلاحيات الكافية لإضافة أرقام محظورة', 'error');
        return;
    }
    
    const phoneNumber = document.getElementById('blockedNumber').value;
    const reason = document.getElementById('blockReason').value;
    
    showLoading('جاري إضافة الرقم المحظور...');
    
    fetchData('addBlockedNumber', {
        phoneNumber: phoneNumber,
        reason: reason
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // تحديث البيانات المحلية
            blockedNumbers.push(response.data);
            
            showMessage('تمت إضافة الرقم إلى القائمة المحظورة بنجاح', 'success');
            
            // إعادة تعيين النموذج وإخفائه
            document.getElementById('newBlockedNumberForm').reset();
            hideAdminForms();
        } else {
            showMessage('فشل في إضافة الرقم المحظور: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error adding blocked number:', error);
        showMessage('حدث خطأ أثناء إضافة الرقم المحظور', 'error');
    });
}

// دالة لإضافة صفحة جديدة
function addPage(event) {
    event.preventDefault();
    
    // التحقق من صلاحيات المستخدم
    if (currentUser.permissionLevel !== 3) {
        showMessage('ليس لديك الصلاحيات الكافية لإضافة صفحات', 'error');
        return;
    }
    
    const pageName = document.getElementById('newPageName').value;
    const pageLink = document.getElementById('pageLink').value;
    const pageDescription = document.getElementById('pageDescription').value;
    
    showLoading('جاري إضافة الصفحة...');
    
    fetchData('addPage', {
        name: pageName,
        link: pageLink,
        description: pageDescription
    })
    .then(response => {
        hideLoading();
        
        if (response.success) {
            // تحديث البيانات المحلية
            pages.push(response.data);
            
            // تحديث قائمة الصفحات في نموذج الحساب
            updatePagesList();
            
            showMessage('تمت إضافة الصفحة بنجاح', 'success');
            
            // إعادة تعيين النموذج وإخفائه
            document.getElementById('newPageForm').reset();
            hideAdminForms();
        } else {
            showMessage('فشل في إضافة الصفحة: ' + response.message, 'error');
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error adding page:', error);
        showMessage('حدث خطأ أثناء إضافة الصفحة', 'error');
    });
}

// دوال المساعدة

// دالة لنسخ نتائج الحساب
function copyCostResult() {
    const resultText = document.getElementById('costResultText').textContent;
    navigator.clipboard.writeText(resultText)
        .then(() => showMessage('تم نسخ النتائج إلى الحافظة', 'success'))
        .catch(err => {
            console.error('Error copying text:', err);
            showMessage('فشل في نسخ النتائج', 'error');
        });
}

// دالة لنسخ تفاصيل الطلب
function copyOrderResult() {
    const resultText = document.getElementById('orderResultText').textContent;
    navigator.clipboard.writeText(resultText)
        .then(() => showMessage('تم نسخ تفاصيل الطلب إلى الحافظة', 'success'))
        .catch(err => {
            console.error('Error copying text:', err);
            showMessage('فشل في نسخ التفاصيل', 'error');
        });
}

// دالة لعرض رسالة
function showMessage(message, type = 'info') {
    // إنشاء عنصر الرسالة
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type === 'error' ? 'danger' : (type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'info'))}`;
    messageDiv.textContent = message;
    
    // إضافة عنصر الرسالة إلى أعلى الصفحة
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    // إزالة الرسالة بعد 5 ثوانٍ
    setTimeout(() => {
        try {
            container.removeChild(messageDiv);
        } catch (e) {
            // تجاهل الخطأ إذا تم إزالة العنصر بالفعل
        }
    }, 5000);
}

// دالة لعرض حالة التحميل
function showLoading(message) {
    // إنشاء عنصر التحميل
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
    `;
    
    // إضافة CSS للتحميل إذا لم يكن موجوداً
    if (!document.getElementById('loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 5px solid var(--light-color);
                border-top: 5px solid var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            
            .loading-message {
                color: white;
                font-size: 18px;
                font-weight: bold;
                text-align: center;
                max-width: 80%;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .invoice-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9998;
            }
            
            .invoice-dialog-content {
                background-color: white;
                border-radius: 10px;
                padding: 20px;
                width: 80%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            }
            
            .invoice-dialog-close {
                position: absolute;
                top: 10px;
                right: 10px;
                font-size: 24px;
                cursor: pointer;
                color: var(--dark-color);
            }
            
            .invoice-details {
                margin: 20px 0;
            }
            
            .invoice-details p {
                margin-bottom: 10px;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // إضافة عنصر التحميل إلى الصفحة
    document.body.appendChild(loadingDiv);
}

// دالة لإخفاء حالة التحميل
function hideLoading() {
    const loadingDiv = document.querySelector('.loading-overlay');
    if (loadingDiv) {
        document.body.removeChild(loadingDiv);
    }
}
