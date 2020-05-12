const removeDuplicates = (phoneNumbers) => {
    const uniqueSet = new Set(phoneNumbers);

    return [...uniqueSet];
}

const removeNonNumbers = (phoneNumber) => {
    let result = '';
    for (let i = 0; i < phoneNumber.length; i++) {
        if (
            phoneNumber[i] === '+' ||
            phoneNumber[i] === '0' ||
            phoneNumber[i] === '1' ||
            phoneNumber[i] === '2' ||
            phoneNumber[i] === '3' ||
            phoneNumber[i] === '4' ||
            phoneNumber[i] === '5' ||
            phoneNumber[i] === '6' ||
            phoneNumber[i] === '7' ||
            phoneNumber[i] === '8' ||
            phoneNumber[i] === '9'
        ) {
            result = result + phoneNumber[i];
        }
    }

    return result;
}

const formatPhoneNumbers = async (phoneNumbers) => {
    try {
        phoneNumbers = removeDuplicates(phoneNumbers);

        let onlyNumbericNumbers = [];

        phoneNumbers.map(phoneNumber => {
            let numericNumber = removeNonNumbers(phoneNumber);

            if (numericNumber.length === 10) {
                numericNumber = '+91' + numericNumber
            }

            if (numericNumber.length > 10) {
                if (numericNumber[0] === '0' && numericNumber[1] === '0') {
                    numericNumber = '+' + numericNumber.substr(2, numericNumber.length)
                }
                onlyNumbericNumbers.push(numericNumber);
            }
        })

        onlyNumbericNumbers = removeDuplicates(onlyNumbericNumbers);

        return onlyNumbericNumbers;
    } catch (err) {
        console.error(err);
        throw err;
    }
}

module.exports = {
    formatPhoneNumbers
}